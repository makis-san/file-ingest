import si, { Systeminformation } from "systeminformation";
import { SystemIO } from "../SystemIO/SystemIO";
import { log } from "../logger";
import fs from "fs";
import path from "path";
import { DBTables } from "../../db/constants";
import { db } from "../../db/db";
import { IngestionAction } from "../../routes/ingestion";
import * as crypto from "crypto";
import { telegraf } from "../Telegraf/Telegraf";
import Queue from "../Queue/Queue";
import directoryTree from "directory-tree";
import EventEmitter from "events";
import { renderProgressBar } from "./utils/renderProgressBar";
import { withConcurrencyLimit } from "./utils/withConcurrencyLimit";

export interface IngestionDevice {
  id: string;
  serial: string;
  deviceDetails: Systeminformation.DiskLayoutData;
  copyOnAttach?: boolean;
  allowedExtensions?: string[];
  copyTo: string;
  copyToDate?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface File {
  path: string;
  name: string;
  type: "file";
  size: number;
  extension: string;
}

export class Ingestion extends EventEmitter {
  private queue: Queue<IngestionDevice>;
  private previousProgressMessage: string = "";
  private messageId: number | undefined;
  private readonly SYSTEM_FILES =
    /(System Volume Information|\$RECYCLE\.BIN|\.Spotlight-V100|\.Trashes|\.fseventsd|EFI)/;
  private progressMap: Record<string, number> = {};
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(private systemIO: SystemIO) {
    super();
    this.queue = new Queue(this.run.bind(this));
    this.systemIO.on("deviceAttached", (devices: IngestionDevice[]) => {
      log(
        "INFO",
        `Devices detected for ingestion: ${devices
          .map((d) => d.serial)
          .join(", ")}`
      );
      this.bulkIngest(devices);
    });
  }

  public ingest(device: IngestionDevice) {
    this.queue.push(device);
  }

  public bulkIngest(devices: IngestionDevice[]) {
    devices.forEach((device) => this.queue.push(device));
  }

  private getDestinationPath(copyTo: string, copyToDate?: boolean): string {
    const dateFolder = new Date().toISOString().split("T")[0];
    return path.join(copyTo, dateFolder);
  }

  public async run(device: IngestionDevice): Promise<void> {
    try {
      const { serial, copyTo, copyToDate } = device;
      log("INFO", `Running ingestion for device: ${serial}`);

      const drive = await this.systemIO.getDriveBySerial(serial);
      if (!drive?.mountpoints) {
        log("ERROR", `Ingestion failed for device: ${serial}`);
        return;
      }

      const srcDir = drive.mountpoints.find((mp) => mp.label !== "EFI")?.path;
      if (!srcDir) {
        log("ERROR", `No valid source directory found for device: ${serial}`);
        return;
      }

      const driveUsage = await this.getDriveUsage(srcDir);
      const used = driveUsage ? driveUsage.used : 0;
      const total = driveUsage ? driveUsage.total : 0;

      await this.sendInitialProgressMessage(serial, used, total);

      const data = await this.filesToCopy(srcDir, serial);
      if (!data) return;

      this.startBatchUpdate();
      const destinationPath = this.getDestinationPath(copyTo, copyToDate);
      await this.copyFilesAndTrackProgress(data, destinationPath, srcDir);
    } catch (err) {
      console.error(err);
    } finally {
      this.stopBatchUpdate();
    }
  }

  private startBatchUpdate() {
    this.updateInterval = setInterval(
      () => this.sendBatchedProgressUpdate(),
      2000
    );
  }

  private stopBatchUpdate() {
    if (this.updateInterval) clearInterval(this.updateInterval);
    this.updateInterval = null;
    this.sendBatchedProgressUpdate();
  }

  private async sendBatchedProgressUpdate() {
    let newMessage = this.previousProgressMessage;
    for (const [fileName, progress] of Object.entries(this.progressMap)) {
      const progressBar = renderProgressBar(progress);
      const progressLine = `${
        progress === 100 ? "✅" : "⏲️"
      } ${fileName} ${progressBar}`;
      const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(^|\\n)(⏲️|✅) ${escapedFileName} .*`, "g");
      newMessage = newMessage.replace(regex, `$1${progressLine}`);
    }
    await this.updateSentMessage(newMessage);
  }

  private async filesToCopy(dir: string, deviceSerial: string) {
    const dirTree = directoryTree(dir, {
      normalizePath: true,
      attributes: ["type", "size", "extension"],
      exclude: this.SYSTEM_FILES,
    });
    const filesToCopy = [] as File[];

    const addFileIfRequired = async (file: directoryTree.DirectoryTree) => {
      const action = (await db.find(
        DBTables.ingestionAction,
        (item) =>
          item.filename === file.path && item.deviceSerial === deviceSerial
      )) as IngestionAction;

      if (
        !action ||
        (await this.calculateChecksum(file.path)) !== action.checksum ||
        file.size !== action.fileSize
      ) {
        filesToCopy.push({
          path: file.path,
          name: file.name,
          type: file.type as "file",
          size: file.size,
          extension: file.extension as string,
        });
      }
    };

    const iterateTree = async (node: directoryTree.DirectoryTree) => {
      if (node.type === "file") await addFileIfRequired(node);
      else if (node.children) await Promise.all(node.children.map(iterateTree));
    };

    await iterateTree(dirTree);
    return filesToCopy;
  }

  private async copyFilesAndTrackProgress(
    filesToCopy: File[],
    copyTo: string,
    srcDir: string
  ) {
    const maxConcurrency = parseInt(process.env?.MAX_CONCURRENCY || "1");

    const folders: { [key: string]: File[] } = {};

    filesToCopy.forEach((file) => {
      const folder = file.path.split("/");
      folder.pop();
      const folderPath = folder.join("/");
      if (!folders[folderPath]) {
        folders[folderPath] = [];
      }
      folders[folderPath].push(file);
    });

    const fileProgressSection = `${Object.keys(folders).map(
      (folderPath) =>
        `📂 <b><i>${folderPath}</i></b>\n${folders[folderPath]
          .map((file) => {
            return `⏲️ ${file.name} [     0%     ]`;
          })
          .join("\n")}`
    )}`;

    await this.updateSentMessage(
      `${this.previousProgressMessage}\n${fileProgressSection}`
    );

    const copyTasks = filesToCopy.map(
      (file) => () => this.copyFile(file, copyTo, srcDir)
    );

    await withConcurrencyLimit(copyTasks, maxConcurrency);
  }

  private async copyFile(file: File, copyTo: string, srcDir: string) {
    try {
      const relativePath = path.relative(srcDir, file.path);
      const destinationPath = path.join(copyTo, relativePath);

      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      await this.copyFileWithProgress(file.path, destinationPath, file.size);
    } catch (error) {
      log("ERROR", `Error copying file ${file.name}:`, error);
    }
  }

  private async copyFileWithProgress(
    sourcePath: string,
    destinationPath: string,
    fileSize: number
  ) {
    try {
      return new Promise<void>((resolve, reject) => {
        const readStream = fs.createReadStream(fs.realpathSync(sourcePath));
        const writeStream = fs.createWriteStream(destinationPath);
        let bytesCopied = 0;

        readStream.on("data", (chunk) => {
          bytesCopied += chunk.length;
          this.progressMap[path.basename(sourcePath)] =
            (bytesCopied / fileSize) * 100;
        });
        readStream.on("error", (error) => reject(error));
        writeStream.on("error", (error) => reject(error));
        writeStream.on("finish", () => resolve());

        readStream.pipe(writeStream);
      });
    } catch (err) {
      log("ERROR", "Failed at copyFileWithProgress " + err);
    }
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const stream = fs.createReadStream(filePath);
      stream.on("data", (data) => hash.update(data));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", reject);
    });
  }

  private async getDriveUsage(
    mountPoint: string
  ): Promise<{ used: number; total: number } | null> {
    const disk = (await si.fsSize()).find((d) => mountPoint.includes(d.mount));
    return disk
      ? { used: disk.used / 1024 ** 3, total: disk.size / 1024 ** 3 }
      : null;
  }

  private async sendInitialProgressMessage(
    serial: string,
    used: number,
    total: number
  ) {
    try {
      const message = `💽 Device: <b>${serial}</b>\n📊 Used: ${used.toFixed(
        2
      )} GB / ${total.toFixed(2)} GB\n\n📂 Starting file processing...\n`;
      const initialMessage = await telegraf.telegram.sendMessage(
        process.env.TELEGRAM_CHAT_ID as string,
        message,
        { parse_mode: "Markdown" }
      );
      this.messageId = initialMessage.message_id;
      this.previousProgressMessage = message;
    } catch (err) {
      log("ERROR", "Failed at sendInitialProgressMessage " + err);
    }
  }

  private async updateSentMessage(message: string) {
    try {
      if (this.messageId) {
        await telegraf.telegram.editMessageText(
          process.env.TELEGRAM_CHAT_ID as string,
          this.messageId,
          undefined,
          message,
          { parse_mode: "HTML" }
        );
        this.previousProgressMessage = message;
      }
    } catch (err) {
      log("ERROR", "Failed at updateSentMessage " + err);
    }
  }
}

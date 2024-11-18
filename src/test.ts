import { Ingestion } from "./system/Ingestion/Ingestion";
import { SystemIO } from "./system/SystemIO/SystemIO";

const system = new SystemIO(() => {});
const ingest = new Ingestion(system);

ingest.run({
  copyTo: "./dest",
  createdAt: new Date().toISOString(),
  deviceDetails: {} as any,
  id: "0",
  serial: "000",
  updatedAt: new Date().toISOString(),
});

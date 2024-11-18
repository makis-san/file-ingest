import { log } from "../logger";
import { v4 as uuidv4 } from "uuid"; // Import UUID library for unique IDs

interface QueueItem<T> {
  id: string;
  data: T;
}

class Queue<T> {
  private queue: QueueItem<T>[] = [];
  private currentProcessing: QueueItem<T> | undefined;
  private isProcessing = false;

  constructor(private processItem: (item: T) => Promise<void>) {}

  /**
   * Adds an item to the queue with a unique identifier and starts processing
   */
  public push(data: T) {
    // Generate a unique identifier for each item in the queue
    const queueItem: QueueItem<T> = { id: uuidv4(), data };
    this.queue.push(queueItem);
    log("INFO", `Item added to queue: ${queueItem.id}`);
    this.processNext();
  }

  /**
   * Starts processing the next item in the queue, if available
   */
  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.currentProcessing = this.queue.shift();
    if (this.currentProcessing) {
      this.isProcessing = true;
      const { id, data } = this.currentProcessing;
      log("INFO", `Started processing item with Queue ID: ${id}`);
      try {
        await this.processItem(data); // Process the generic item
      } catch (error) {
        log("ERROR", `Error processing item with Queue ID: ${id}: ${error}`);
      } finally {
        log("INFO", `Finished processing item with Queue ID: ${id}`);
        this.isProcessing = false;
        this.processNext();
      }
    }
  }

  /**
   * Removes the current item after it finishes processing
   */
  public finish(id: string) {
    if (this.currentProcessing?.id === id) {
      this.currentProcessing = undefined;
      this.processNext();
    }
  }
}

export default Queue;

import type { Response } from "express";

interface SSEClient {
  fileId: string;
  res: Response;
}

class SSEManager {
  private clients: SSEClient[] = [];

  addClient(fileId: string, res: Response) {
    this.clients.push({ fileId, res });
  }

  removeClient(res: Response) {
    this.clients = this.clients.filter((c) => c.res !== res);
  }

  // push progress only to clients listening to this specific fileId
  sendProgress(fileId: string, data: Record<string, unknown>) {
    this.clients
      .filter((c) => c.fileId === fileId)
      .forEach((c) => {
        c.res.write(`data: ${JSON.stringify(data)}\n\n`);
      });
  }
}

export const sseManager = new SSEManager();

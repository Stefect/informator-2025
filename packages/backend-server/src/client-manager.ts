/**
 * Менеджер клієнтів (Capture Clients та Viewers)
 */

import WebSocket from 'ws';
import { logger } from './logger';
import { CLIENT_TYPES } from './constants';
import { generateId } from './utils';

export type ClientType = typeof CLIENT_TYPES.CAPTURE | typeof CLIENT_TYPES.VIEWER | typeof CLIENT_TYPES.UNKNOWN;

export interface ClientInfo {
    id: string;
    ws: WebSocket;
    type: ClientType;
    connectedAt: Date;
    lastActivity: Date;
    metadata?: any;
}

export class ClientManager {
    private clients = new Map<string, ClientInfo>();

    constructor() {
        logger.info('👥 ClientManager ініціалізовано');
    }

    public addClient(ws: WebSocket, type: ClientType = CLIENT_TYPES.UNKNOWN): string {
        const clientId = generateId('client');
        
        const clientInfo: ClientInfo = {
            id: clientId,
            ws,
            type,
            connectedAt: new Date(),
            lastActivity: new Date()
        };

        this.clients.set(clientId, clientInfo);
        logger.info(`➕ Клієнт підключено: ${clientId} (тип: ${type})`);
        
        return clientId;
    }

    public removeClient(clientId: string): void {
        const client = this.clients.get(clientId);
        if (client) {
            this.clients.delete(clientId);
            logger.info(`➖ Клієнт відключено: ${clientId} (тип: ${client.type})`);
        }
    }

    public getClient(clientId: string): ClientInfo | undefined {
        return this.clients.get(clientId);
    }

    public setClientType(clientId: string, type: ClientType): void {
        const client = this.clients.get(clientId);
        if (client) {
            client.type = type;
            logger.debug(`🏷️ Тип клієнта ${clientId} змінено на: ${type}`);
        }
    }

    public setClientMetadata(clientId: string, metadata: any): void {
        const client = this.clients.get(clientId);
        if (client) {
            client.metadata = metadata;
        }
    }

    public updateActivity(clientId: string): void {
        const client = this.clients.get(clientId);
        if (client) {
            client.lastActivity = new Date();
        }
    }

    public getCaptureClients(): ClientInfo[] {
        return Array.from(this.clients.values()).filter(
            client => client.type === CLIENT_TYPES.CAPTURE
        );
    }

    public getViewers(): ClientInfo[] {
        return Array.from(this.clients.values()).filter(
            client => client.type === CLIENT_TYPES.VIEWER
        );
    }

    public getClientCount(): number {
        return this.clients.size;
    }

    public getCaptureClientCount(): number {
        return this.getCaptureClients().length;
    }

    public getViewerCount(): number {
        return this.getViewers().length;
    }

    public getAllClients(): ClientInfo[] {
        return Array.from(this.clients.values());
    }
}

/**
 * Менеджер клієнтів (Capture Clients та Viewers)
 */

import WebSocket from 'ws';
import { logger } from './logger';

export type ClientType = 'capture_client' | 'viewer' | 'unknown';

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
    private clientIdCounter = 0;

    constructor() {
        logger.info('👥 ClientManager ініціалізовано');
    }

    public addClient(ws: WebSocket, type: ClientType = 'unknown'): string {
        const clientId = this.generateClientId();
        
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
            client => client.type === 'capture_client'
        );
    }

    public getViewers(): ClientInfo[] {
        return Array.from(this.clients.values()).filter(
            client => client.type === 'viewer'
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

    private generateClientId(): string {
        return `client_${++this.clientIdCounter}_${Date.now()}`;
    }

    public getAllClients(): ClientInfo[] {
        return Array.from(this.clients.values());
    }
}

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';
import { logger, logError } from '../../utils/logger';
import path from 'path';
import fs from 'fs';

export class StoryService {
    private client: TelegramClient;
    private sessionString: string;
    private apiId: number;
    private apiHash: string;
    private isConnected: boolean = false;
    private tempDir: string;

    constructor(apiId: number, apiHash: string, sessionString: string, tempDir: string) {
        this.apiId = apiId;
        this.apiHash = apiHash;
        this.sessionString = sessionString;
        this.tempDir = tempDir;

        const stringSession = new StringSession(this.sessionString);
        this.client = new TelegramClient(stringSession, this.apiId, this.apiHash, {
            connectionRetries: 5,
        });
    }

    public async connect(): Promise<void> {
        try {
            if (!this.isConnected) {
                await this.client.connect();
                this.isConnected = true;
                logger.info('✅ StoryService: Connected to MTProto');
            }
        } catch (error) {
            logError(error as Error, { service: 'StoryService', operation: 'connect' });
            this.isConnected = false;
        }
    }

    public async disconnect(): Promise<void> {
        if (this.isConnected) {
            await this.client.disconnect();
            this.isConnected = false;
            logger.info('StoryService: Disconnected');
        }
    }

    public async downloadStory(url: string): Promise<{ filePath: string; caption?: string } | null> {
        if (!this.isConnected) {
            await this.connect();
        }

        try {
            // Parse URL: https://t.me/username/s/123 or https://t.me/c/123123123/123
            // Standard story link: https://t.me/username/s/123
            const match = url.match(/t\.me\/([^\/]+)\/s\/(\d+)/);
            if (!match) {
                throw new Error('Invalid story URL format');
            }

            const username = match[1];
            const storyId = parseInt(match[2]);

            logger.info('StoryService: Fetching story', { username, storyId });

            // Get Peer
            const peer = await this.client.getEntity(username);

            // Get Story
            const stories = await this.client.invoke(
                new Api.stories.GetStoriesByID({
                    peer: peer,
                    id: [storyId],
                })
            ) as Api.stories.Stories;

            if (!stories || !stories.stories || stories.stories.length === 0) {
                throw new Error('Story not found or expired');
            }

            const story = stories.stories[0];

            if (story instanceof Api.StoryItemDeleted) {
                throw new Error('Story has been deleted');
            }
            if (story instanceof Api.StoryItemSkipped) {
                throw new Error('Story has been skipped');
            }

            // Download Media
            const media = story.media;
            if (!media) {
                throw new Error('Story has no media');
            }

            const fileName = `story_${username}_${storyId}_${Date.now()}`;
            const outputFile = path.join(this.tempDir, fileName);

            await this.client.downloadMedia(media, {
                outputFile: outputFile
            });

            // Determine extension based on file signature or just check file existence and rename if needed
            // gram.js usually handles extensions if outputFile doesn't have one, but let's check.
            // Actually, downloadMedia returns a Buffer or writes to file.
            // If we provided outputFile without extension, we might need to find the file.

            // Let's try to find the file with any extension in tempDir
            const files = fs.readdirSync(this.tempDir);
            const downloadedFile = files.find(f => f.startsWith(fileName));

            if (!downloadedFile) {
                throw new Error('Failed to locate downloaded file');
            }

            const fullPath = path.join(this.tempDir, downloadedFile);

            return {
                filePath: fullPath,
                caption: story.caption ? story.caption : undefined
            };

        } catch (error) {
            logError(error as Error, { service: 'StoryService', operation: 'downloadStory', url });
            throw error;
        }
    }
}

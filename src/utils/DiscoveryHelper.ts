import { TestUser } from '../testdata/discovery/discovery-types';

/**
 * Helper utility for Discovery flow operations
 */
export class DiscoveryHelper {
    /**
     * Generate a unique username with timestamp
     * Format: testuser_<timestamp>
     */
    static generateUniqueUsername(): string {
        const timestamp = Date.now();
        return `testuser_${timestamp}`;
    }

    /**
     * Create a test user with username as password
     * As per requirement: "Create a unique username with same password as username"
     */
    static createTestUser(): TestUser {
        const username = this.generateUniqueUsername();
        return {
            username,
            password: username, // Password same as username
            timestamp: Date.now(),
        };
    }

    /**
     * Generate multiple test users
     */
    static createMultipleTestUsers(count: number): TestUser[] {
        const users: TestUser[] = [];
        for (let i = 0; i < count; i++) {
            users.push(this.createTestUser());
            // Small delay to ensure unique timestamps
            const now = Date.now();
            while (Date.now() === now) {
                // Wait for timestamp to change
            }
        }
        return users;
    }

    /**
     * Wait for audio to complete (mock implementation)
     */
    static async waitForAudioCompletion(durationMs: number = 2000): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, durationMs));
    }

    /**
     * Simulate recording delay
     */
    static async simulateRecording(durationMs: number = 3000): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, durationMs));
    }
}

import { TestUser } from '../testdata/discovery/discovery-types';

/**
 * Helper utility for Discovery flow operations
 */
export class DiscoveryHelper {
    /**
     * Generate a unique username with timestamp
     * Format: testuser_<timestamp>_<pid>_<random>
     *
     * Timestamp alone collides when two SEPARATE processes generate a username in the same
     * millisecond — confirmed live (2026-08-27): running English and Hindi FULL_E2E in parallel
     * (scripts/run-full-e2e-parallel.js, launched via Promise.all) produced two child processes
     * that both computed `Date.now()` in the same millisecond, so they created identical
     * "testuser_<timestamp>" accounts and collided on the real app — one session's login
     * overwrote/interfered with the other's. `createMultipleTestUsers`'s busy-wait loop below only
     * guards against two calls in the SAME process; it does nothing for two different processes'
     * independent clocks. `process.pid` + a random suffix make collisions require both the same
     * millisecond AND the same OS process AND the same random draw — actually unique in practice.
     */
    static generateUniqueUsername(): string {
        const timestamp = Date.now();
        const pid = process.pid;
        const random = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
        return `testuser_${timestamp}_${pid}_${random}`;
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

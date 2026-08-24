/**
 * Provider-agnostic Visual-Question-Answering (VQA) service.
 *
 * Given an image (PNG/JPEG bytes), a question, and the list of on-screen answer options,
 * it asks a vision-capable model which option is correct and returns the model's raw answer
 * text. Kept deliberately separate from Playwright so the vision provider can be swapped
 * (Anthropic ⇄ OpenAI ⇄ a future internal service) without touching the S1 UI flow.
 *
 * Configuration is read from the environment (no keys hardcoded):
 *   VISION_PROVIDER  anthropic | openai            (default: anthropic)
 *   VISION_API_KEY   the provider API key          (REQUIRED to run; else isConfigured()=false)
 *   VISION_MODEL     model id                       (default per provider)
 *   VISION_ENDPOINT  override the HTTP endpoint      (optional)
 *   VISION_MAX_TOKENS max response tokens            (default: 64)
 *
 * Reusable for any image-based assessment in M4–M9 — not S1-specific.
 */
export interface VisionConfig {
    provider: 'anthropic' | 'openai';
    apiKey: string;
    model: string;
    endpoint: string;
    maxTokens: number;
}

const DEFAULT_MODELS: Record<string, string> = {
    anthropic: 'claude-sonnet-5',
    openai: 'gpt-4o',
};
const DEFAULT_ENDPOINTS: Record<string, string> = {
    anthropic: 'https://api.anthropic.com/v1/messages',
    openai: 'https://api.openai.com/v1/chat/completions',
};

export class VisionService {
    private readonly cfg: VisionConfig;

    constructor(cfg?: Partial<VisionConfig>) {
        const provider = ((cfg?.provider || process.env.VISION_PROVIDER || 'anthropic').toLowerCase()) as 'anthropic' | 'openai';
        this.cfg = {
            provider,
            apiKey: cfg?.apiKey ?? process.env.VISION_API_KEY ?? '',
            model: cfg?.model ?? process.env.VISION_MODEL ?? DEFAULT_MODELS[provider] ?? DEFAULT_MODELS.anthropic,
            endpoint: cfg?.endpoint ?? process.env.VISION_ENDPOINT ?? DEFAULT_ENDPOINTS[provider] ?? DEFAULT_ENDPOINTS.anthropic,
            maxTokens: cfg?.maxTokens ?? Number(process.env.VISION_MAX_TOKENS || 64),
        };
    }

    /** True when an API key is present so the service can actually be called. */
    isConfigured(): boolean {
        return this.cfg.apiKey.trim().length > 0;
    }

    get describe(): string {
        return `${this.cfg.provider}:${this.cfg.model}`;
    }

    /**
     * Ask the model which option the image + question point to. Returns the model's raw
     * text answer (matching to a specific option is done separately, in answerMatcher, so the
     * matching logic is testable independent of the provider).
     */
    async answer(imageBase64: string, mediaType: string, question: string, options: string[]): Promise<string> {
        if (!this.isConfigured()) throw new Error('VisionService not configured: set VISION_API_KEY');
        const prompt = this.buildPrompt(question, options);
        const raw = this.cfg.provider === 'openai'
            ? await this.callOpenAI(imageBase64, mediaType, prompt)
            : await this.callAnthropic(imageBase64, mediaType, prompt);
        return (raw || '').trim();
    }

    private buildPrompt(question: string, options: string[]): string {
        const list = options.map((o, i) => `${i + 1}. ${o}`).join('\n');
        return [
            'You are answering a simple picture-based question for a children\'s reading app.',
            'Look carefully at the image, then answer the question by choosing exactly one option.',
            '',
            `Question: ${question}`,
            'Options:',
            list,
            '',
            'Reply with ONLY the exact text of the single correct option, copied verbatim from the list above.',
            'Do not add punctuation, quotes, explanation, or the option number — just the option text.',
        ].join('\n');
    }

    private async callAnthropic(imageBase64: string, mediaType: string, prompt: string): Promise<string> {
        const res = await fetch(this.cfg.endpoint, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': this.cfg.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: this.cfg.model,
                max_tokens: this.cfg.maxTokens,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
                        { type: 'text', text: prompt },
                    ],
                }],
            }),
        });
        if (!res.ok) throw new Error(`Anthropic vision HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
        const json = await res.json() as { content?: Array<{ type: string; text?: string }> };
        return (json.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join(' ').trim();
    }

    private async callOpenAI(imageBase64: string, mediaType: string, prompt: string): Promise<string> {
        const res = await fetch(this.cfg.endpoint, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${this.cfg.apiKey}`,
            },
            body: JSON.stringify({
                model: this.cfg.model,
                max_tokens: this.cfg.maxTokens,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
                    ],
                }],
            }),
        });
        if (!res.ok) throw new Error(`OpenAI vision HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
        const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
        return (json.choices?.[0]?.message?.content || '').trim();
    }
}

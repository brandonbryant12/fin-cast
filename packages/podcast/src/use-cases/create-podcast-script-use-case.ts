import { InternalServerError } from '@repo/errors';
import type { PersonalityInfo } from '../personalities/personalities';
import type { PodcastScriptOutput } from '../types/podcast-script';
import type { ChatResponse, LLMInterface } from '@repo/llm';
import type { AppLogger } from '@repo/logger';
import type { CompileCapablePromptVersion, PromptRegistry } from '@repo/prompt-registry';

interface CreatePodcastScriptUseCaseDeps {
    logger: AppLogger;
    llm: LLMInterface;
    promptRegistry: PromptRegistry;
}

export type CreatePodcastScriptInput = {
    content: string;
    hostInfo: PersonalityInfo;
    cohostInfo: PersonalityInfo;
};

export default class CreatePodcastScriptUseCase {
    private readonly logger: AppLogger;
    private readonly llm: LLMInterface;
    private readonly promptRegistry: PromptRegistry;

    constructor({
        logger,
        llm,
        promptRegistry,
    }: CreatePodcastScriptUseCaseDeps) {
        this.logger = logger.child({ context: 'CreatePodcastScriptUseCase' });
        this.llm = llm;
        this.promptRegistry = promptRegistry;
    }

    async execute({ content, hostInfo, cohostInfo }: CreatePodcastScriptInput): Promise<PodcastScriptOutput> {
        this.logger.info({ hostName: hostInfo.name, cohostName: cohostInfo.name }, 'Generating podcast script.');

        const promptDef = await this.promptRegistry.get('podcast-script-generator');
        if (!promptDef) {
            this.logger.error('Prompt definition "podcast-script-generator" not found.');
            throw new InternalServerError('Prompt definition "podcast-script-generator" not found.');
        }

        const promptRuntime = (promptDef as CompileCapablePromptVersion).compile<PodcastScriptOutput>({
            htmlContent: content,
            hostName: hostInfo.name,
            hostPersonalityDescription: hostInfo.description,
            cohostName: cohostInfo.name,
            cohostPersonalityDescription: cohostInfo.description,
        });

        const messages = promptRuntime.toMessages();
        this.logger.info('Calling LLM with compiled prompt for script generation.');
        const raw = await this.llm.chatCompletion(messages, {
            temperature: promptDef.temperature,
            maxTokens: promptDef.maxTokens,
        });

        let llmResponse: ChatResponse<PodcastScriptOutput> | null = null;
        llmResponse = {
            ...raw,
            structuredOutput: raw.content ? promptRuntime.validate(raw.content) : undefined,
        };

        if (llmResponse.error || !llmResponse.structuredOutput) {
            const errorMsg = llmResponse?.error ?? 'LLM did not return valid structured output for podcast script.';
            this.logger.error({ errorMsg, llmResponse }, 'LLM script generation failed.');
            throw new InternalServerError(errorMsg);
        }

        this.logger.info('Podcast script generated successfully.');
        return llmResponse.structuredOutput;
    }
}

import { Prompt, type SchemaLib, type PromptOptions } from './prompt'; // Adjust path if necessary

// --- Mock Schema Library Implementation ---
// We need simple mocks that satisfy the SchemaLib interface for testing.

interface MockSchema<T> extends SchemaLib<(input: unknown) => T> {
    _typeString: string;
}

function createMockSchema<T>(typeString: string, validator: (input: unknown) => T): MockSchema<T> {
    return {
        parse: (input: unknown): T => {
            try {
                return validator(input);
            } catch (e) {
                // Simulate schema library throwing an error on validation failure
                throw new Error(`MockSchema validation failed: ${e instanceof Error ? e.message : String(e)}`);
            }
        },
        _getTypeString: () => typeString,
        _typeString: typeString, // Store for easy assertion
    };
}

// Define mock schemas for testing
const mockParamSchema = createMockSchema<{ name: string }>('{\n  name: string;\n}', (input: unknown) => {
    if (typeof input === 'object' && input !== null && 'name' in input && typeof (input as any).name === 'string') {
        return input as { name: string };
    }
    throw new Error('Invalid input structure');
});

const mockOutputSchema = createMockSchema<{ greeting: string }>('{\n  greeting: string;\n}', (input: unknown) => {
    if (typeof input === 'object' && input !== null && 'greeting' in input && typeof (input as any).greeting === 'string') {
        return input as { greeting: string };
    }
    throw new Error('Invalid output structure');
});

// --- Test Suite ---

describe('Prompt', () => {

    // Test data
    const promptName = 'test-prompt';
    const promptDescription = 'A simple test prompt.';
    const promptTemplate = (params: { name: string }) => `Hello, ${params.name}!`;
    const defaultOptions: PromptOptions = { temperature: 0.5, maxTokens: 500 };

    // --- Test Prompt.define ---
    describe('static define', () => {
        it('should create a Prompt instance with correct properties', () => {
            const prompt = Prompt.define({
                name: promptName,
                description: promptDescription,
                paramSchema: mockParamSchema,
                outputSchema: mockOutputSchema,
                template: promptTemplate,
                defaultOptions: defaultOptions,
            });

            expect(prompt).toBeInstanceOf(Prompt);
            expect(prompt.name).toBe(promptName);
            expect(prompt.description).toBe(promptDescription);
            expect(prompt.paramSchema).toBe(mockParamSchema);
            expect(prompt.outputSchema).toBe(mockOutputSchema);
            expect(prompt.template).toBe(promptTemplate);
            // Check merged default options
            expect(prompt.defaultOptions).toEqual({
                systemPrompt: "You are a helpful assistant.", // Default
                temperature: 0.5, // Overridden
                maxTokens: 500, // Overridden
                topP: 1.0, // Default
            });
        });

        it('should use default options if none are provided', () => {
            const prompt = Prompt.define({
                name: promptName,
                paramSchema: mockParamSchema,
                outputSchema: mockOutputSchema,
                template: promptTemplate,
            });

            expect(prompt.defaultOptions).toEqual({
                systemPrompt: "You are a helpful assistant.",
                temperature: 0.7,
                maxTokens: 1024,
                topP: 1.0,
            });
        });

        it('should throw an error if name is empty', () => {
            expect(() => {
                Prompt.define({
                    name: '', // Empty name
                    paramSchema: mockParamSchema,
                    outputSchema: mockOutputSchema,
                    template: promptTemplate,
                });
            }).toThrow("Prompt name cannot be empty.");
        });
    });

    // --- Test Prompt.builder ---
    describe('static builder', () => {
        it('should create a Prompt instance using the fluent builder', () => {
            const prompt = Prompt.builder(promptName)
                .describe(promptDescription)
                .input(mockParamSchema)
                .output(mockOutputSchema)
                .template(promptTemplate)
                .defaults(defaultOptions)
                .build();

            expect(prompt).toBeInstanceOf(Prompt);
            expect(prompt.name).toBe(promptName);
            expect(prompt.description).toBe(promptDescription);
            expect(prompt.paramSchema).toBe(mockParamSchema);
            expect(prompt.outputSchema).toBe(mockOutputSchema);
            expect(prompt.template).toBe(promptTemplate);
            // Check merged default options
            expect(prompt.defaultOptions).toEqual({
                systemPrompt: "You are a helpful assistant.", // Default
                temperature: 0.5, // Overridden
                maxTokens: 500, // Overridden
                topP: 1.0, // Default
            });
        });

        it('should build successfully with only required fields', () => {
            const prompt = Prompt.builder(promptName)
                .input(mockParamSchema)
                .output(mockOutputSchema)
                .template(promptTemplate)
                .build();

            expect(prompt).toBeInstanceOf(Prompt);
            expect(prompt.name).toBe(promptName);
            expect(prompt.description).toBeUndefined(); // Optional
            expect(prompt.defaultOptions).toEqual({ // Should use all base defaults
                systemPrompt: "You are a helpful assistant.",
                temperature: 0.7,
                maxTokens: 1024,
                topP: 1.0,
            });
        });

        it('should throw errors if required builder steps are skipped', () => {
            // Missing input
            expect(() => {
                // Cast to any to bypass TS type checks for this test
                (Prompt.builder(promptName) as any)
                    .build();
            }).toThrow("Builder error: Input schema is required.");

            // Missing output
            expect(() => {
                // Cast to any to bypass TS type checks for this test
                (Prompt.builder(promptName)
                    .input(mockParamSchema) as any)
                    .build();
            }).toThrow("Builder error: Output schema is required.");

            // Missing template
            expect(() => {
                // Cast to any to bypass TS type checks for this test
                (Prompt.builder(promptName)
                    .input(mockParamSchema)
                    .output(mockOutputSchema) as any)
                    .build();
            }).toThrow("Builder error: Template function is required.");
        });
    });

    // --- Test validateParams ---
    describe('validateParams', () => {
        const prompt = Prompt.define({
            name: promptName,
            paramSchema: mockParamSchema,
            outputSchema: mockOutputSchema,
            template: promptTemplate,
        });

        it('should return validated params for valid input', () => {
            const validParams = { name: 'Alice' };
            const result = prompt.validateParams(validParams);
            expect(result).toEqual(validParams);
        });

        it('should throw an error for invalid input', () => {
            const invalidInput = { age: 30 }; // Missing 'name'
            expect(() => {
                prompt.validateParams(invalidInput);
            }).toThrow('MockSchema validation failed: Invalid input structure'); // Expect the error from the mock schema
        });
    });

    // --- Test render ---
    describe('render', () => {
        const prompt = Prompt.define({
            name: promptName,
            paramSchema: mockParamSchema,
            outputSchema: mockOutputSchema,
            template: promptTemplate,
            defaultOptions: { systemPrompt: 'Base system prompt.' },
        });

        const validParams = { name: 'Bob' };

        it('should render the prompt correctly with default options', () => {
            const { system, user } = prompt.render(validParams);

            expect(system).toBe('Base system prompt.');
            expect(user).toContain('Hello, Bob!');
            expect(user).toContain('# Output Instructions');
            expect(user).toContain('MUST respond ONLY with valid JSON');
            expect(user).toContain('```typescript');
            expect(user).toContain(mockOutputSchema._typeString); // Check schema representation
            expect(user).toContain('```');
            expect(user).toContain('Do NOT include any other text, explanations, or markdown formatting outside the JSON structure.');
        });

        it('should render the prompt correctly with runtime options overriding defaults', () => {
            const runtimeOptions: PromptOptions = { systemPrompt: 'Runtime system prompt override.' };
            const { system, user } = prompt.render(validParams, runtimeOptions);

            expect(system).toBe('Runtime system prompt override.'); // Should use runtime override
            expect(user).toContain('Hello, Bob!'); // User template is the same
            expect(user).toContain(mockOutputSchema._typeString); // Schema instruction is the same
        });

        it('should validate params before rendering', () => {
            const invalidParams = { age: 30 };
            expect(() => {
                prompt.render(invalidParams as any); // Cast to any to bypass TS check for test
            }).toThrow('MockSchema validation failed: Invalid input structure');
        });
    });

    // --- Test parseOutput ---
    describe('parseOutput', () => {
        const prompt = Prompt.define({
            name: promptName,
            paramSchema: mockParamSchema,
            outputSchema: mockOutputSchema,
            template: promptTemplate,
        });

        it('should parse and validate valid JSON output', () => {
            const rawOutput = '{\n  "greeting": "Hello from LLM!"\n}';
            const result = prompt.parseOutput(rawOutput);
            expect(result).toEqual({ greeting: 'Hello from LLM!' });
        });

        it('should parse and validate valid JSON output wrapped in markdown', () => {
            const rawOutput = '```json\n{\n  "greeting": "Hello from LLM!"\n}\n```';
            const result = prompt.parseOutput(rawOutput);
            expect(result).toEqual({ greeting: 'Hello from LLM!' });
        });

        it('should parse and validate valid JSON output wrapped in markdown without language', () => {
            const rawOutput = '```\n{\n  "greeting": "Hello from LLM!"\n}\n```';
            const result = prompt.parseOutput(rawOutput);
            expect(result).toEqual({ greeting: 'Hello from LLM!' });
        });


        it('should throw an error for invalid JSON string', () => {
            const rawOutput = 'This is not JSON';
            expect(() => {
                prompt.parseOutput(rawOutput);
            }).toThrow('[Prompt "test-prompt"] JSON Parsing Error: Unexpected token T in JSON at position 0'); // Expect JSON parse error
        });

        it('should throw an error for valid JSON that does not match the output schema', () => {
            const rawOutput = '{\n  "message": "Wrong structure"\n}'; // Missing 'greeting'
            expect(() => {
                prompt.parseOutput(rawOutput);
            }).toThrow('MockSchema validation failed: Invalid output structure'); // Expect schema validation error
        });

        it('should throw an error for empty or whitespace output', () => {
            expect(() => {
                prompt.parseOutput('');
            }).toThrow('[Prompt "test-prompt"] JSON Parsing Error: Received empty content after cleaning.');

            expect(() => {
                prompt.parseOutput('   \n  ');
            }).toThrow('[Prompt "test-prompt"] JSON Parsing Error: Received empty content after cleaning.');

             expect(() => {
                prompt.parseOutput('```json\n\n```');
            }).toThrow('[Prompt "test-prompt"] JSON Parsing Error: Received empty content after cleaning.');
        });
    });

    // --- Test withOptions ---
    describe('withOptions', () => {
        const basePrompt = Prompt.define({
            name: promptName,
            paramSchema: mockParamSchema,
            outputSchema: mockOutputSchema,
            template: promptTemplate,
            defaultOptions: { temperature: 0.7, maxTokens: 1024, systemPrompt: 'Base system.' },
        });

        it('should create a new Prompt instance', () => {
            const newPrompt = basePrompt.withOptions({ temperature: 0.9 });
            expect(newPrompt).not.toBe(basePrompt);
            expect(newPrompt).toBeInstanceOf(Prompt);
        });

        it('should override specified default options', () => {
            const newPrompt = basePrompt.withOptions({ temperature: 0.9, topP: 0.8 });
            expect(newPrompt.defaultOptions).toEqual({
                systemPrompt: 'Base system.', // Inherited
                temperature: 0.9, // Overridden
                maxTokens: 1024, // Inherited
                topP: 0.8, // Overridden
            });
        });

        it('should inherit unspecified default options', () => {
            const newPrompt = basePrompt.withOptions({ temperature: 0.9 });
            expect(newPrompt.defaultOptions).toEqual({
                systemPrompt: 'Base system.', // Inherited
                temperature: 0.9, // Overridden
                maxTokens: 1024, // Inherited
                topP: 1.0, // Inherited (from base default, not basePrompt's defaultOptions)
            });
        });

        it('should retain name, description, schemas, and template', () => {
            const newPrompt = basePrompt.withOptions({ temperature: 0.9 });
            expect(newPrompt.name).toBe(basePrompt.name);
            expect(newPrompt.description).toBe(basePrompt.description);
            expect(newPrompt.paramSchema).toBe(basePrompt.paramSchema);
            expect(newPrompt.outputSchema).toBe(basePrompt.outputSchema);
            expect(newPrompt.template).toBe(basePrompt.template);
        });
    });

    // --- Test toJSON ---
    describe('toJSON', () => {
        const prompt = Prompt.define({
            name: promptName,
            description: promptDescription,
            paramSchema: mockParamSchema,
            outputSchema: mockOutputSchema,
            template: promptTemplate,
            defaultOptions: defaultOptions,
        });

        it('should return a plain object representation', () => {
            const json = prompt.toJSON();

            expect(json).toEqual({
                name: promptName,
                description: promptDescription,
                paramSchema: mockParamSchema, // Schemas are included
                outputSchema: mockOutputSchema, // Schemas are included
                template: promptTemplate, // Template function is included
                defaultOptions: { // Merged defaults are included
                    systemPrompt: "You are a helpful assistant.",
                    temperature: 0.5,
                    maxTokens: 500,
                    topP: 1.0,
                },
            });
        });
    });

    // --- Test inspect ---
    describe('inspect', () => {
         const prompt = Prompt.define({
            name: promptName,
            description: promptDescription,
            paramSchema: mockParamSchema,
            outputSchema: mockOutputSchema,
            template: promptTemplate,
            defaultOptions: defaultOptions,
        });

        it('should return a string representation for debugging', () => {
            const inspectionString = prompt.inspect();
            expect(typeof inspectionString).toBe('string');

            expect(inspectionString).toContain(promptName);
            expect(inspectionString).toContain(promptDescription);

            
        });
    });
});

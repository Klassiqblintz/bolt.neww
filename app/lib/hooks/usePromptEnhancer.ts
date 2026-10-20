import { useState } from 'react';
import { toast } from 'react-toastify';
import { parseError } from '~/lib/errors';
import { DEFAULT_MODEL_ID } from '~/lib/models';
import { chatOptionsStore } from '~/lib/stores/buildMode';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('usePromptEnhancement');

export function usePromptEnhancer() {
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [promptEnhanced, setPromptEnhanced] = useState(false);

  const resetEnhancer = () => {
    setEnhancingPrompt(false);
    setPromptEnhanced(false);
  };

  const enhancePrompt = async (input: string, setInput: (value: string) => void) => {
    setEnhancingPrompt(true);
    setPromptEnhanced(false);

    const originalInput = input;

    try {
      const response = await fetch('/api/enhancer', {
        method: 'POST',
        body: JSON.stringify({
          message: input,
          modelId: chatOptionsStore.get().modelId || DEFAULT_MODEL_ID,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');

        throw new Error(body || `Request failed with status ${response.status}`);
      }

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('The response body was empty.');
      }

      const decoder = new TextDecoder();

      let _input = '';

      setInput('');

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        _input += decoder.decode(value);

        logger.trace('Set input', _input);

        setInput(_input);
      }

      setPromptEnhanced(true);
    } catch (error) {
      /**
       * Restore the original prompt so the user does not lose their input when
       * the request fails.
       */
      logger.error('Failed to enhance prompt\n\n', error);

      setInput(originalInput);

      const { message } = parseError(error instanceof Error ? error.message : undefined);

      toast.error(message);
    } finally {
      // the loading state is always cleared, even if the request failed
      setEnhancingPrompt(false);
    }
  };

  return { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer };
}

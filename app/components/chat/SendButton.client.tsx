import { AnimatePresence, cubicBezier, motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';

interface SendButtonProps {
  show: boolean;
  isStreaming?: boolean;
  hasError?: boolean;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}

const customEasingFn = cubicBezier(0.4, 0, 0.2, 1);

/**
 * The submit control of the prompt composer.
 *
 * It reflects the state of the request: idle, disabled (nothing to send),
 * loading (streaming, the click stops the response) and error.
 */
export function SendButton({ show, isStreaming, hasError, disabled, onClick }: SendButtonProps) {
  /**
   * While streaming the button stops the response, so it stays enabled. With an
   * error the button allows sending the prompt again. Otherwise it is disabled
   * while there is nothing to send.
   */
  const isDisabled = !isStreaming && !hasError && !!disabled;
  const isErrorState = !!hasError;

  return (
    <AnimatePresence>
      {show ? (
        <motion.button
          type="button"
          className={classNames(
            'absolute flex justify-center items-center top-[18px] right-[22px] p-1 rounded-lg w-[34px] h-[34px] transition-all duration-150',
            {
              'bg-accent-500 text-white hover:brightness-110 active:brightness-95 shadow-md shadow-accent-500/25':
                !isErrorState && !isDisabled,
              'bg-bolt-elements-item-backgroundActive text-bolt-elements-textTertiary cursor-not-allowed':
                isDisabled && !isErrorState,
              'bg-bolt-elements-button-danger-background text-bolt-elements-button-danger-text hover:bg-bolt-elements-button-danger-backgroundHover':
                isErrorState,
            },
          )}
          transition={{ ease: customEasingFn, duration: 0.17 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          disabled={isDisabled}
          title={hasError ? 'Send again' : isStreaming ? 'Stop generating' : 'Send message'}
          aria-label={hasError ? 'Send again' : isStreaming ? 'Stop generating' : 'Send message'}
          onClick={(event) => {
            event.preventDefault();

            if (isDisabled) {
              return;
            }

            onClick?.(event);
          }}
        >
          <div className="text-lg">
            {isStreaming ? (
              <div className="i-ph:stop-circle-bold" />
            ) : hasError ? (
              <div className="i-ph:warning-circle-bold" />
            ) : (
              <div className="i-ph:arrow-right" />
            )}
          </div>
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}

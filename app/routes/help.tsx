import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { Header } from '~/components/header/Header';
import { ProviderStatusBanner } from '~/components/header/ProviderStatusBanner';
import { Menu } from '~/components/sidebar/Menu.client';

export const meta: MetaFunction = () => {
  return [
    { title: 'Help · Bolt' },
    { name: 'description', content: 'How to configure providers, pick models and use the workspace' },
  ];
};

export const loader = () => json({});

const SECTIONS = [
  {
    icon: 'i-ph:plugs',
    title: 'Configure an AI provider',
    body: [
      'Bolt needs an AI provider to generate code. The server can be configured with an API key (ANTHROPIC_API_KEY or OPENROUTER_API_KEY), or you can bring your own key.',
      'Open "AI providers" in the sidebar, add a provider, paste its API key and set it as default. Your key is encrypted in this browser and only decrypted in memory when a request is sent — it is never stored on a server and never written to a log.',
    ],
  },
  {
    icon: 'i-ph:sparkle',
    title: 'Select a model',
    body: [
      'Use the model dropdown next to the composer to pick the model for new messages. With a user provider the list is loaded from that provider, and you can also type a model id manually.',
      'The selection is remembered together with the provider it belongs to, so it survives a reload and is never sent to a different provider.',
    ],
  },
  {
    icon: 'i-ph:code',
    title: 'Use the coding workspace',
    body: [
      'Describe what you want to build and press Enter. Bolt answers in the chat and writes files into the workspace on the right: a file tree, an editor, a terminal and a live preview.',
      'Every generated file, shell command and preview update comes from the artifact stream of the model — nothing is faked. You can edit files yourself; changes are saved before your next message is sent.',
    ],
  },
  {
    icon: 'i-ph:buildings',
    title: 'Build modes and planning',
    body: [
      'The four tiles under the composer (Website, Slides, App, Prototype) steer what the assistant builds. The choice is included in the first message of a conversation.',
      'The "Plan" toggle asks the model to outline a plan before writing any code.',
    ],
  },
];

export default function HelpRoute() {
  return (
    <div className="flex flex-col h-full w-full">
      <Header />
      <ProviderStatusBanner />
      <ClientOnly fallback={null}>{() => <Menu />}</ClientOnly>
      <div className="flex-1 overflow-y-auto bg-bolt-elements-background-depth-1">
        <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-2xl font-semibold text-bolt-elements-textPrimary">Help center</h1>
          <p className="mt-1 text-sm text-bolt-elements-textSecondary">
            How to connect a provider, choose a model and work with the coding chat.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {SECTIONS.map((section) => (
              <section
                key={section.title}
                className="rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-bolt-elements-surface-cardIcon text-bolt-elements-surface-cardIconText">
                    <span className={section.icon} aria-hidden="true" />
                  </span>
                  <h2 className="text-base font-medium text-bolt-elements-textPrimary">{section.title}</h2>
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  {section.body.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-6 text-bolt-elements-textSecondary">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

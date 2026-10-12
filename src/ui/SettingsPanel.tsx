import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import type { Lang, Quality } from '../core/types';
import {
  applyUpdate,
  checkForUpdate,
  lang,
  setSettings,
  settings,
  shareLine,
  standalone,
  t,
  updateReady,
  type Theme,
} from '../state/store';
import { MarkIcon, ShareIcon } from './icons';

interface Option<T extends string> {
  readonly value: T;
  readonly label: string;
  /** Endonyms are spoken in their own language. */
  readonly lang?: Lang;
  readonly swatch?: Theme;
}

/** Native radios, drawn as a segmented control whose thumb slides to the choice. */
function Segmented<T extends string>({
  name,
  labelledBy,
  describedBy,
  value,
  options,
  onChange,
}: {
  name: string;
  labelledBy: string;
  describedBy?: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
}) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  return (
    <div
      class="segmented"
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      style={{ '--count': String(options.length), '--index': String(index) }}
    >
      {options.map((option) => (
        <label key={option.value} class="segmented__option" lang={option.lang}>
          <input
            class="visually-hidden"
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          {option.swatch && <span class={`swatch swatch--${option.swatch}`} aria-hidden="true" />}
          <span class="segmented__label">{option.label}</span>
        </label>
      ))}
    </div>
  );
}

function Group({ id, title, children }: { id: string; title: string; children: ComponentChildren }) {
  return (
    <section class="group" aria-labelledby={id}>
      <h3 class="group__title" id={id}>
        {title}
      </h3>
      {children}
    </section>
  );
}

const buildDate = (language: Lang): string => {
  const date = new Date(`${__BUILD_DATE__}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? __BUILD_DATE__
    : new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'long' }).format(date);
};

export function SettingsPanel() {
  const dict = t.value;
  const language = lang.value;
  const { theme, quality } = settings.value;
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    try {
      await checkForUpdate();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div class="settings">
      <Group id="settings-theme" title={dict.appearance}>
        <Segmented<Theme>
          name="theme"
          labelledBy="settings-theme"
          value={theme}
          options={[
            { value: 'auto', label: dict.themeAuto, swatch: 'auto' },
            { value: 'light', label: dict.themeLight, swatch: 'light' },
            { value: 'dark', label: dict.themeDark, swatch: 'dark' },
          ]}
          onChange={(value) => setSettings({ theme: value })}
        />
      </Group>

      <Group id="settings-lang" title={dict.language}>
        <Segmented<Lang>
          name="lang"
          labelledBy="settings-lang"
          value={language}
          options={[
            { value: 'fr', label: 'Français', lang: 'fr' },
            { value: 'en', label: 'English', lang: 'en' },
          ]}
          onChange={(value) => setSettings({ lang: value })}
        />
      </Group>

      <Group id="settings-quality" title={dict.quality}>
        <Segmented<Quality>
          name="quality"
          labelledBy="settings-quality"
          describedBy="settings-quality-hint"
          value={quality}
          options={[
            { value: 'hifi', label: dict.hifi },
            { value: 'eco', label: dict.eco },
          ]}
          onChange={(value) => setSettings({ quality: value })}
        />
        <p class="group__hint" id="settings-quality-hint">
          {dict.qualityHint}
        </p>
      </Group>

      <Group id="settings-share" title={dict.shareLine}>
        <p class="group__hint group__hint--lead">{dict.shareLineHint}</p>
        <button type="button" class="pill-btn" onClick={() => void shareLine()}>
          <ShareIcon size={20} />
          <span>{dict.share}</span>
        </button>
      </Group>

      {!standalone.value && (
        <Group id="settings-install" title={dict.install}>
          <ol class="steps" role="list">
            {dict.installSteps.map((step) => (
              <li key={step} class="steps__step">
                {step}
              </li>
            ))}
          </ol>
        </Group>
      )}

      <Group id="settings-about" title={dict.about}>
        <div class="about">
          <MarkIcon size={44} class="about__mark" />
          <div>
            <p class="about__name">Ondes</p>
            <p class="about__version">{dict.version(__APP_VERSION__, buildDate(language))}</p>
          </div>
        </div>
        <p class="about__text">{dict.honesty}</p>
        <p class="group__hint">{dict.credits}</p>
        {updateReady.value ? (
          <button type="button" class="pill-btn" onClick={applyUpdate}>
            <span>{dict.updateNow}</span>
          </button>
        ) : (
          <button type="button" class="pill-btn pill-btn--quiet" aria-disabled={checking || undefined} onClick={() => !checking && void check()}>
            <span>{checking ? dict.checking : dict.checkUpdate}</span>
          </button>
        )}
      </Group>
    </div>
  );
}

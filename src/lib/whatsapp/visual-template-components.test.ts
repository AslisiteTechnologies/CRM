import { describe, expect, it } from 'vitest';
import type { MessageTemplate } from '@/types';
import { buildSendComponents } from './template-send-builder';

const template = {
  header_type: 'image',
  header_media_url: 'https://cdn.example.com/review-example.jpg',
  body_text: "Hi {{1}}, we're Aslisite.",
  buttons: [{ type: 'URL', text: 'View Website', url: 'https://aslisite-gym-template.vercel.app/{{1}}' }],
} as MessageTemplate;

describe('Aslisite visual demo template send components', () => {
  it('sends per-recipient image URL, business name and slug separately', () => {
    expect(buildSendComponents(template, {
      headerMediaUrl: 'https://cdn.example.com/muscle-and-fitness.png',
      body: ['Muscle and Fitness'],
      buttonParams: { 0: 'muscle-and-fitness' },
    })).toEqual([
      { type: 'header', parameters: [{ type: 'image', image: { link: 'https://cdn.example.com/muscle-and-fitness.png' } }] },
      { type: 'body', parameters: [{ type: 'text', text: 'Muscle and Fitness' }] },
      { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: 'muscle-and-fitness' }] },
    ]);
  });
  it('keeps legacy image sample fallback for existing callers', () => {
    const components = buildSendComponents(template, { body: ['Gym'], buttonParams: { 0: 'gym' } });
    expect(components[0]).toEqual({
      type: 'header', parameters: [{ type: 'image', image: { link: 'https://cdn.example.com/review-example.jpg' } }],
    });
  });
  it('requires the URL suffix when the approved button is dynamic', () => {
    expect(() => buildSendComponents(template, { body: ['Gym'], headerMediaUrl: 'https://cdn.example.com/gym.png' })).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { isValidHttpsImageUrl } from './template-image-url';

describe('image header HTTPS URL validation', () => {
  it('allows public HTTPS screenshot URLs', () => {
    expect(isValidHttpsImageUrl('https://aslisite-gym-template.vercel.app/images/screenshots/muscle-and-fitness.png')).toBe(true);
    expect(isValidHttpsImageUrl('https://cdn.example.com/image.jpg?version=1')).toBe(true);
  });
  it.each([
    '', 'http://example.com/photo.png', 'file:///tmp/a.png', 'https://localhost/image.png',
    'https://127.0.0.1/x.png', 'https://[::1]/x.png', 'https://host.local/x.png',
    'https://username:password@example.com/a.png', 'https://example.com:8443/a.png',
    'https://example.com/a.png#frag', 'https://example.com/a.png ',
  ])('rejects unsafe or non-HTTPS input %s', (url) => {
    expect(isValidHttpsImageUrl(url)).toBe(false);
  });
});

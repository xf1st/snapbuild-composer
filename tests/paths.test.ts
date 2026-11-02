import {it,expect} from 'vitest';
import {assetUrl} from '../src/paths';
it('loads library assets under both the local root and a Pages deployment prefix',()=>{expect(assetUrl('/library/book.svg','/')).toBe('/library/book.svg');expect(assetUrl('library.json','/snapbuild-composer/')).toBe('/snapbuild-composer/library.json');expect(assetUrl('/library/book.svg','/snapbuild-composer/')).toBe('/snapbuild-composer/library/book.svg');});

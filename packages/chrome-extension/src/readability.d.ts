declare module './lib/Readability' {
    export class Readability {
        constructor(doc: Document);
        parse(): { title: string; textContent: string } | null;
    }
}

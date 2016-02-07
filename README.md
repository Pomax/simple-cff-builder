A simple CFF builder for testing fonts with different Type2 charstrings.

If you just want to "make some fonts", not build tools are necessary.
Simply:

1. clone this repo.
2. Load the `index.html` in the browser through a server (python -m SimpleServer,
node's http-server or live-server, etc. etc.)
3. modify the `subroutines/program.default` file to give it the charstring you want, and
4. reload the page in your browser.

To download your font, simply click the "download this font as OTF file." link
underneath the GSUB table section, and done.

- Pomax

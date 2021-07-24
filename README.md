# PDF.js Mini Viewers (PMV) <img height="20" src="badges/version.svg" alt="v1.0.0"> <img height="20" src="badges/license.svg" alt="MIT license">
PDF.js Mini Viewers offers a completely different web viewer experience than the one that comes with the [PDF.js](https://github.com/mozilla/pdf.js) library natively. PMV is designed to be an easy drop-in for any project or website that needs the ability to display PDFs. PMV was originally created for use with the [JamsEDU](https://github.com/caboodle-tech/jams-edu) application to easily embedded multiple PDFs on a single page.

**PDF.js (PDFJS)**

[PDF.js](https://github.com/mozilla/pdf.js) is a Portable Document Format (PDF) viewer built with HTML5. PDFJS is community-driven and supported by Mozilla. PMV is built on top of PDFJS which uses the Apache-2.0 license.

<img height="20" src="badges/pdfjs-license.svg" alt="Apache-2.0 license">

## Demo
You can view a [live demo here](https://caboodle-tech.github.io/pdf.js-mini-viewers/).

## Installation
Your project will need to copy in everything from the `css` and `js` directory.

You can separate the JavaScript files from the CMAP files but you will need to tell PMV where you put them; see the usage section for more information.

## Usage
1. Include the PDFJS script `pdf.js` on every page you wish to display a PDF; this script must be loaded before the next script.
2. Include the PMV script `pdf-viewer.js` on every page you wish to display a PDF.
3. At the bottom of the page or from another function that is already part of your site, such as a document ready function, initialize PMV:
```javascript
/*
Paths can be relative or absolute but should be on the same server:
path/to/pdf-worker.js ==> Tell PMV where pdf-worker.js is located
path/to/cmaps         ==> Tell PMV where the CMAP folder is located.
*/
PDFMiniViewers.initialize( 'path/to/pdf-worker.js', 'path/to/cmaps' );
```

After you initialize PMV it will automatically search the page for PDF divs to convert into mini viewers. Here is the basic HTML you will need to add a PDF to the page.

```html
<div data-pdf="path/to/your.pdf"></div>
```

## Advanced Usage

### Hiding Buttons
You can hide the print and download buttons by adding the following option(s) to the PDF div. Keep in mind that a tech savvy user can easily bypass this restriction since the PDF source URL is exposed. You should treat any PDF you show to users as printable or downloadable from a security perspective.

```html
<div data-pdf="path/to/your.pdf" data-options="no-print no-download"></div>
```

### Dynamically Adding PDFs
If you dynamically add PDFs to a page you can call the initialize function again. PMV protects from duplicate PDF processing and will only convert new PDFs into a mini viewer.

### Responding to Fullscreen
If your website design needs to respond/ react to a PDF entering or exiting fullscreen you can use the following methods:

```javascript
// Register a function for PMV to call when a PDF enters or exits fullscreen.
PDFMiniViewers.addFullscreenCallback( function );

// Remove a previously registered function so it stops being called on fullscreen events.
PDFMiniViewers.removeFullscreenCallback( function );
```
You can register an anonymous function with PMV using `addFullscreenCallback` but it is recommended that you provide a function name instead. When a PDF enters fullscreen your function (or functions if you registered multiple) will be called with a single boolean argument: `true` a PDF is in fullscreen mode, `false` the PDF is no longer fullscreen.

## Contributions
PMV is an open source community supported project, if you would like to help please consider <a href="https://github.com/caboodle-tech/pdf.js-mini-viewers/issues" target="_blank">tackling an issue</a> or <a href="https://ko-fi.com/caboodletech" target="_blank">making a donation</a> to keep the project alive.
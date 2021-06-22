var PDFMiniViewers = ( function() {

    "use strict";

    var CMAPS;
    var DEBOUNCE_FUNCS = {};
    var DEBOUNCE_TIMER = {};
    var HEIGHT;
    var ICON = {
        bookmark: '<svg class="pdf-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M19 24l-7-6-7 6v-24h14v24z"/></svg>',
        caretDown: '<svg class="pdf-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 21l-12-18h24z"/></svg>',
        caretRight: '<svg class="pdf-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M21 12l-18 12v-24z"/></svg>',
        compress: '<svg class="pdf-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M15 2h2v5h7v2h-9v-7zm9 13v2h-7v5h-2v-7h9zm-15 7h-2v-5h-7v-2h9v7zm-9-13v-2h7v-5h2v7h-9z"/></svg>',
        down: '<svg class="pdf-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 24l-8-9h6v-15h4v15h6z"/></svg>',
        download: '<svg class="pdf-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 21l-8-9h6v-12h4v12h6l-8 9zm9-1v2h-18v-2h-2v4h22v-4h-2z"/></svg>',
        expand: '<svg class="pdf-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M24 9h-2v-5h-7v-2h9v7zm-9 13v-2h7v-5h2v7h-9zm-15-7h2v5h7v2h-9v-7zm9-13v2h-7v5h-2v-7h9z"/></svg>',
        minus: '<svg class="pdf-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M0 10h24v4h-24z"/></svg>',
        plus: '<svg class="pdf-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M24 10h-10v-10h-4v10h-10v4h10v10h4v-10h10z"/></svg>',
        print: '<svg class="pdf-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M14 20h-6v-1h6v1zm10-15v13h-4v6h-16v-6h-4v-13h4v-5h16v5h4zm-6 10h-12v7h12v-7zm0-13h-12v3h12v-3zm4 5.5c0-.276-.224-.5-.5-.5s-.5.224-.5.5.224.5.5.5.5-.224.5-.5zm-6 9.5h-8v1h8v-1z"/></svg>',
        reset: '<svg class="pdf-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 0c-3.31 0-6.291 1.353-8.459 3.522l-2.48-2.48-1.061 7.341 7.437-.966-2.489-2.488c1.808-1.808 4.299-2.929 7.052-2.929 5.514 0 10 4.486 10 10s-4.486 10-10 10c-3.872 0-7.229-2.216-8.89-5.443l-1.717 1.046c2.012 3.803 6.005 6.397 10.607 6.397 6.627 0 12-5.373 12-12s-5.373-12-12-12z"/></svg>',
        up: '<svg class="pdf-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 0l8 9h-6v15h-4v-15h-6z"/></svg>'
    };
    var PDFS = {};
    var THROTTLE_FUNC = {};
    var THROTTLE_TIMER = {};

    var clearScrollLock = function( viewer ) {
        viewer.removeAttribute('data-scroll-lock');
    };

    var convertPdfs = function( viewer ) {
        
        // Asynchronous download PDF.
        var loadingTask = pdfjsLib.getDocument( {
            url: viewer.dataset.pdf,
            cMapUrl: CMAPS,
            cMapPacked: true,
        } );

        loadingTask.promise.then(
            function( pdf ) {
                var id = uid();
                PDFS[ id ] = pdf;

                var container = document.createElement('DIV');
                container.id = id;
                container.classList.add('pdf-mini-viewer');

                viewer.parentNode.insertBefore( container, viewer );
                viewer.parentNode.removeChild( viewer );

                viewer.dataset.id = id;
                viewer.dataset.zoom = '0.00';
                viewer.classList.add('pdf-viewer');
                viewer.style.height = HEIGHT;
                viewer.addEventListener( 'scroll', debounce( updateCurrentPage, 100 ), true );
                viewer.addEventListener( 'click', goToBookmark, false );

                var mainToolbar    = getMainToolbarHTML( pdf.numPages );
                var resizeToolbar  = getResizeToolbarHTML();

                container.appendChild( mainToolbar );
                container.appendChild( viewer );
                container.appendChild( resizeToolbar );

                var styles = window.getComputedStyle( viewer );
                var padding = parseInt( styles.paddingTop.replace( /\D+/g, '' ) );
                padding += parseInt( styles.paddingBottom.replace( /\D+/g, '' ) );
                viewer.dataset.scroll = padding;

                pdf.getOutline().then(
                    renderBookmarks.bind( null, container ),
                    function( error ) {
                        console.error( error );
                    }
                );

                var loaded = 0;
                while( loaded < pdf.numPages ) {
                    loaded++;
                    // Asynchronous load PDF page.
                    pdf.getPage( loaded ).then(
                        loadPage.bind( null, viewer ),
                        function( error ) {
                            console.error( error );
                        }
                    );
                }
            },
            function( error ) {
                console.error( error );
            }
        );
    };

    // https://stackoverflow.com/a/52256801/3193156
    var debounce = function( func, delay ) {
        delay = delay || 250;
        var hash = 'F' + getStringHash( func.toString() );
        if ( ! DEBOUNCE_FUNCS[ hash ] ) {
            DEBOUNCE_FUNCS[ hash ] = [ func, event ];
            return function() {
                DEBOUNCE_FUNCS[ hash ][1] = event;
                if ( DEBOUNCE_TIMER[ hash ] ) {
                    clearTimeout( DEBOUNCE_TIMER[ hash ] );
                }
                DEBOUNCE_TIMER[ hash ] = setTimeout( doDebounce.bind( null, hash ), delay );
            }
        }
    };

    var doDebounce = function( hash ) {
        if ( DEBOUNCE_FUNCS[ hash ] ) {
            DEBOUNCE_FUNCS[ hash ][0].call( null, DEBOUNCE_FUNCS[ hash ][1] );
        }
    };

    var eventBookmark = function() {
        var app = this.closest('.pdf-mini-viewer');
        app.classList.toggle('bookmarks-open');
    };

    var eventDownload = function() {
        var viewer = this.closest('.pdf-mini-viewer').querySelector('.pdf-viewer');
        var a = document.createElement('A');
        a.setAttribute( 'href', viewer.dataset.pdf );
        a.setAttribute( 'target', '_blank' );
        a.setAttribute( 'download', '' );
        a.click();
    };

    var eventPageChange = function() {
        if ( event.key == 'Enter' || event.keyCode == 13 ) {
            var input = this.querySelector('.current-page');
            var page  = parseInt( input.value );
            var total = parseInt( this.querySelector('.page-total').innerHTML );
            if ( page < 1 ) { 
                page = 1;
            }
            if ( page > total ) {
                page = total;
            }
            input.value = page;

            var app = this.closest('.pdf-mini-viewer');
            var viewer = app.querySelector('.pdf-viewer');
            viewer.dataset.scrollLock = true;
            var pageElem = viewer.querySelector('[data-page-number="' + page + '"]');
            if ( pageElem ) {
                pageElem.scrollIntoView( { block: 'start',  behavior: 'smooth' } );
            }

            setTimeout( clearScrollLock.bind( null, viewer ), 1000 );
        }
    };

    var eventPageDown = function() {
        var input = this.parentElement.querySelector('.page-wrapper .current-page');
        var page  = parseInt( input.value ) + 1;
        var total = parseInt( this.parentElement.querySelector('.page-wrapper .page-total').innerHTML );
        if ( page > total ) {
            page = total;
        }
        input.value = page;

        var app = this.closest('.pdf-mini-viewer');
        var viewer = app.querySelector('.pdf-viewer');
        viewer.dataset.scrollLock = true;
        var pageElem = viewer.querySelector('[data-page-number="' + page + '"]');
        if ( pageElem ) {
            pageElem.scrollIntoView( { block: 'start',  behavior: 'smooth' } );
        }
        
        setTimeout( clearScrollLock.bind( null, viewer ), 500 );
    };

    var eventPageUp = function() {
        var input = this.parentElement.querySelector('.page-wrapper .current-page');
        var page  = parseInt( input.value ) - 1;
        if ( page < 1 ) {
            page = 1;
        }
        input.value = page;
        
        var app = this.closest('.pdf-mini-viewer');
        var viewer = app.querySelector('.pdf-viewer');
        viewer.dataset.scrollLock = true;
        var pageElem = viewer.querySelector('[data-page-number="' + page + '"]');
        if ( pageElem ) {
            pageElem.scrollIntoView( { block: 'start',  behavior: 'smooth' } );
        }

        setTimeout( clearScrollLock.bind( null, viewer ), 500 );
    };

    var eventPrint = function() {
        var mini = this.closest('.pdf-mini-viewer');
        var pdf  = PDFS[ mini.id ];
        // TODO: This will work to print BUT it will not save any form data yet!
        // TODO: Implement updated to pdf.annotationStorage when form fields are filled out.
        pdf.saveDocument( pdf.annotationStorage ).then(
            // Success.
            function( data ) {
                // Get the PDF as a blob.
                var getUrl = window.location;
                var url = getUrl.protocol + "//" + getUrl.host + "/" + getUrl.pathname.split('/')[1];
                var blob = new Blob( [data], { type: "application/pdf" } );
                var url = URL.createObjectURL( blob );
                // Open it in a new tab and let the browser render it for printing.
                var a = document.createElement("A");
                a.target = '_blank';
                a.href = url;
                a.click();
            },
            // Error.
            function( e ) {
                console.error( e );
            }
        );
    };

    var eventZoomCompress = function() {
        var viewer = this.closest('.pdf-mini-viewer').querySelector('.pdf-viewer');
        var zoomCtl = this.closest('.pdf-mini-viewer').querySelector('.pdf-resize-toolbar');
        viewer.dataset.fit = 'fit';
        zoomCtl.classList.remove('page-actual');
        zoomCtl.classList.add('page-fit');
        rerenderPDF( viewer.dataset.id );
    };

    var eventZoomExpand = function() {
        var viewer  = this.closest('.pdf-mini-viewer').querySelector('.pdf-viewer');
        var zoomCtl = this.closest('.pdf-mini-viewer').querySelector('.pdf-resize-toolbar');
        viewer.dataset.fit = 'actual';
        zoomCtl.classList.add('page-actual');
        zoomCtl.classList.remove('page-fit');
        rerenderPDF( viewer.dataset.id );
    };

    var eventZoomIn = function() {
        var control = this.closest('.pdf-resize-toolbar');
        var viewer  = this.closest('.pdf-mini-viewer').querySelector('.pdf-viewer');
        var oldZoom = parseFloat( viewer.dataset.zoom );
        var newZoom = oldZoom + .15;
        if ( newZoom > .75 ) {
            newZoom = .75;
        }
        if ( newZoom != 0 ) {
            control.classList.add('zoomed');
        } else {
            control.classList.remove('zoomed');
        }
        if ( oldZoom != newZoom ) {
            viewer.dataset.zoom = newZoom.toFixed(2);
            rerenderPDF( viewer.dataset.id );
        }
    };

    var eventZoomOut = function() {
        var control = this.closest('.pdf-resize-toolbar');
        var viewer  = this.closest('.pdf-mini-viewer').querySelector('.pdf-viewer');
        var oldZoom = parseFloat( viewer.dataset.zoom );
        var newZoom = oldZoom - .15;
        if ( newZoom < -.75 ) {
            newZoom = -.75;
        }
        if ( newZoom != 0 ) {
            control.classList.add('zoomed');
        } else {
            control.classList.remove('zoomed');
        }
        if ( oldZoom != newZoom ) {
            viewer.dataset.zoom = newZoom.toFixed(2);
            rerenderPDF( viewer.dataset.id );
        }
    };

    var eventZoomReset = function() {
        var control = this.closest('.pdf-resize-toolbar');
        var viewer = this.closest('.pdf-mini-viewer').querySelector('.pdf-viewer');
        control.classList.remove('zoomed');
        viewer.dataset.zoom = '0.00';
        rerenderPDF( viewer.dataset.id );
    };

    // For small PDFs this math is overkill but larger ones need the accuracy.
    var updateCurrentPage = function( e ) {
        var view = e.srcElement;
        if ( ! view.dataset.scrollLock ) {
            // 0 = Viewer top and bottom padding combined.
            // 1 = Page height.
            // 2 = Page bottom margin.
            var dims = view.dataset.scroll.split(':');
            dims[0] = parseFloat( dims[0] );
            dims[1] = parseFloat( dims[1] );
            dims[2] = parseFloat( dims[2] );
            var guess  = ( ( view.scrollTop + dims[0] ) / dims[1] ) + 1;
            var modify = guess * dims[2];
            var page   = Math.floor( ( ( view.scrollTop + dims[0] + modify ) / dims[1] ) + 1 );
            document.querySelector('#' + view.dataset.id + ' .pdf-main-toolbar .current-page').value = page;
        }
    };

    var getAnnotationHTML = function( data ) {
        switch( data.subtype.toUpperCase() ) {
            case 'LINK':
                var a = document.createElement('A');
                var href = '';
                if ( data.dest ) {
                    href = '#' + encodeURIComponent( JSON.stringify( data.dest ) );
                    a.setAttribute( 'target', '_self' );
                } else {
                    href = data.url;
                    a.setAttribute( 'target', '_blank' );
                }
                a.setAttribute( 'href', href );
                return [ a, 'link-annotation' ];
            case 'WIDGET':
                return getWidgetHTML( data );
            default:
                console.warn('Unsupported annotation type. Support might be added from: https://github.com/mozilla/pdf.js/blob/2a7827a7c67375a239284f9d37986a2941e51dba/test/unit/annotation_spec.js');
                return [ document.createElement('SPAN'), '' ];
        }
    };

    var getMainToolbarHTML = function( total ) {
        // Main toolbar.
        var div = document.createElement('DIV');
        div.classList.add('pdf-main-toolbar');
        // Page up.
        var elem = document.createElement('DIV');
        elem.classList.add('page-up');
        elem.innerHTML = ICON.up;
        elem.addEventListener( 'click', eventPageUp );
        div.appendChild( elem );
        // Page down.
        elem = document.createElement('DIV');
        elem.classList.add('page-down');
        elem.innerHTML = ICON.down;
        elem.addEventListener( 'click', eventPageDown );
        div.appendChild( elem );
        // Page number.
        elem = document.createElement('DIV');
        elem.classList.add('page-wrapper');
        elem.innerHTML = '<input type="number" value="1" class="current-page" min="1" max="' + total + '"> <span class="page-spacer">/</span> <span class="page-total">' + total + '</span>';
        elem.addEventListener( 'keyup', eventPageChange );
        div.appendChild( elem );
        // Download.
        elem = document.createElement('DIV');
        elem.classList.add('download');
        elem.innerHTML = ICON.download;
        elem.addEventListener( 'click', eventDownload );
        div.appendChild( elem );
        // Print.
        elem = document.createElement('DIV');
        elem.classList.add('print');
        elem.innerHTML = ICON.print;
        elem.addEventListener( 'click', eventPrint );
        div.appendChild( elem );
        // Bookmark.
        elem = document.createElement('DIV');
        elem.classList.add('bookmark');
        elem.innerHTML = ICON.bookmark;
        elem.addEventListener( 'click', eventBookmark );
        div.appendChild( elem );
        // Send back toolbar.
        return div;
    };
    
    var getResizeToolbarHTML = function() {
        // Resize toolbar.
        var div = document.createElement('DIV');
        div.classList.add('pdf-resize-toolbar');
        // Reset.
        var elem = document.createElement('DIV');
        elem.classList.add('zoom-reset', 'button');
        elem.innerHTML = ICON.reset;
        elem.addEventListener( 'click', eventZoomReset );
        div.appendChild( elem );
        // Expand.
        var elem = document.createElement('DIV');
        elem.classList.add('zoom-expand', 'button');
        elem.innerHTML = ICON.expand;
        elem.addEventListener( 'click', eventZoomExpand );
        div.appendChild( elem );
        // Compress.
        var elem = document.createElement('DIV');
        elem.classList.add('zoom-compress', 'button');
        elem.innerHTML = ICON.compress;
        elem.addEventListener( 'click', eventZoomCompress );
        div.appendChild( elem );
        // Zoom in.
        var elem = document.createElement('DIV');
        elem.classList.add('zoom-in', 'button');
        elem.innerHTML = ICON.plus;
        elem.addEventListener( 'click', eventZoomIn );
        div.appendChild( elem );
        // Zoom out.
        var elem = document.createElement('DIV');
        elem.classList.add('zoom-out', 'button');
        elem.innerHTML = ICON.minus;
        elem.addEventListener( 'click', eventZoomOut );
        div.appendChild( elem );
        return div;
    };

    // https://stackoverflow.com/a/13382873/3193156
    var getScrollbarWidth = function() {

        // Creating invisible container
        var outer = document.createElement('div');
        outer.style.visibility = 'hidden';
        outer.style.overflow = 'scroll'; // forcing scrollbar to appear
        outer.style.msOverflowStyle = 'scrollbar'; // needed for WinJS apps
        document.body.appendChild(outer);
      
        // Creating inner element and placing it in the container
        var inner = document.createElement('div');
        outer.appendChild(inner);
      
        // Calculating difference between container's full width and the child width
        var scrollbarWidth = (outer.offsetWidth - inner.offsetWidth);
      
        // Removing temporary elements from the DOM
        outer.parentNode.removeChild(outer);

        if ( scrollbarWidth == 0 ) {
            scrollbarWidth = 16; // Average default width; Mac will return 0 because they use overlays
        }
      
        return scrollbarWidth;
    };

    var getStringHash = function( string ) {
        var hash = 0, i = 0, len = string.length;
        while ( i < len ) {
            hash  = ( ( hash << 5 ) - hash + string.charCodeAt(i++) ) << 0;
        }
        if ( hash < 0 ) {
            hash *= -1;
        }
        return hash;
    };

    var getWidgetHTML = function( data ) {
        switch( data.fieldType.toUpperCase() ) {
            case 'BTN':
                var elem = document.createElement('INPUT');
                elem.id = data.id;
                elem.setAttribute( 'type', 'checkbox' );
                elem.setAttribute( 'name', data.fieldName );
                if ( data.exportValue == data.fieldValue ) {
                    elem.checked = true;
                    elem.setAttribute( 'value', data.exportValue );
                }
                return [ elem, 'buttonWidgetAnnotation checkBox' ];
            case 'CH':
                var elem = document.createElement('SELECT');
                elem.id = data.id;
                elem.setAttribute( 'name', data.fieldName );
                if ( data.multiSelect ) {
                    elem.setAttribute( 'multiple', '' );
                }
                var options = '';
                for( var i = 0; i < data.options.length; i++ ) {
                    options += '<option value="' + data.options[i].exportValue + '"';
                    if ( data.fieldValue.includes( data.options[i].exportValue ) ) {
                        options += ' selected="true"';
                    }
                    options += '>' + data.options[i].displayValue + '</option>';
                }
                elem.innerHTML = options;
                return [ elem, 'choiceWidgetAnnotation' ];
            case 'TX':
                var elem = document.createElement('INPUT');
                elem.id = data.id;
                elem.setAttribute( 'type', 'text' );
                elem.setAttribute( 'name', data.fieldName );
                elem.setAttribute( 'value', data.fieldValue );
                return [ elem, 'textWidgetAnnotation' ];
            default:
                console.warn('Unsupported widget type. Support might be added from: https://github.com/mozilla/pdf.js/blob/2a7827a7c67375a239284f9d37986a2941e51dba/test/unit/annotation_spec.js');
                return [ document.createElement('SPAN'), '' ];
        }
    };

    var goToBookmark = function() {
        if ( event.srcElement ) {
            if ( event.srcElement.tagName == 'A' ) {
                event.preventDefault();
                var view = this.closest('.pdf-mini-viewer').querySelector('.pdf-viewer');
                var pdf  = PDFS[ view.dataset.id ];
                var link = event.srcElement;

                if ( link.target.toUpperCase() == '_BLANK' ) {
                    // Create a temporary link otherwise we cause an infinite loop by clicking the link.
                    var a = document.createElement('A');
                    a.setAttribute( 'href', link.href );
                    a.setAttribute( 'target', '_blank' );
                    a.click();
                    return;
                }
                link = link.href.substr( event.srcElement.href.indexOf('#') + 1 );
                link = JSON.parse( decodeURIComponent( link ) );
                pdf.getPageIndex( link[0] ).then( 
                    function( page ) {
                        // PDFJS counts pages from 0 so add 1.
                        page += 1;
                        // Now calculate the location and scroll to it.
                        var viewStyles = window.getComputedStyle( view );
                        var pageStyles = window.getComputedStyle( view.querySelector('.page') );
                        var viewMargin = parseFloat( viewStyles.marginTop.replace( /[^0-9.]/g, '' ) );
                        var pageHeight = parseFloat( pageStyles.height.replace( /[^0-9.]/g, '' ) );
                        var pageMargin = parseFloat( pageStyles.marginBottom.replace( /[^0-9.]/g, '' ) );
                        var y = viewMargin
                        if ( page > 1 ) {
                            // Go down (add) the amount of pages (including margins) as needed.
                            y += ( pageHeight + pageMargin ) * page;
                            // Go up (subtract) the Y coordinate of the link and this pages bottom margin.
                            y -= link[3] + pageMargin;
                            /**
                             * Be a bit more generous with how much we go up (subtract) to insure that
                             * the anchor is always in view.
                             */
                            y -= ( link[3] / pageHeight ) * link[3];
                            // If the anchor is near the bottom of a page be extra generous.
                            if ( link[3] < ( pageHeight / 2 ) ) {
                                y -= pageMargin + link[3] / 2;
                            }
                        } else {
                            y -= link[3];
                        }
                        view.scrollTo( link[2], y );
                    }
                );
            }
        }
    };

    var handleWindowResize = function() {
        for ( var prop in PDFS ) {
            var viewer = document.querySelector('.pdf-viewer[data-id="' + prop + '"]');
            viewer.dataset.zoom = '0.00';
            var zoomToolbar = document.querySelector('#' + prop + ' .pdf-resize-toolbar');
            zoomToolbar.classList.remove('zoomed');
            rerenderPDF( prop );
        }
    };

    /**
     * Activate PDFMiniViewers.
     */
     var initialize = function( worker, cmaps ) {
        if ( worker && cmaps ) {
            if ( pdfjsLib.getDocument ) {
                // The workerSrc property must be specified.
                pdfjsLib.GlobalWorkerOptions.workerSrc = worker;
                CMAPS = cmaps;
                HEIGHT = ( window.innerHeight * .70 ) + 'px';
                // Search the page for all embedded PDFs and convert them to viewers.
                var pdfs = document.querySelectorAll('[data-pdf]');
                pdfs.forEach( function( pdf ) {
                    // Do not convert a viewer that has already been done.
                    if ( ! pdf.dataset.id ) {
                        convertPdfs( pdf );
                    }
                } );
                // Attach window resize listener.
                window.addEventListener( 'resize', debounce( handleWindowResize ), true );
            } else {
                console.log('You must load PDF.js before you initialize PDFMiniViewers.');
            }
        } else {
            console.log('You must initialize PDFMiniViewers with the location of the [pdf.worker.js] file and the path to the [cmaps] folder.');
        }
    };

    var loadPage = function( viewer, PDFPageProxy ) {

        // Start in desktop mode using an approximation of actual size as the scale.
        var scale = 1.5;
        var mode  = 'page-actual';
        var unscaledViewport = PDFPageProxy.getViewport( { scale: 1 } );
        var browserUseableWidth = viewer.offsetWidth - getScrollbarWidth() * 3;
        browserUseableWidth = parseFloat( browserUseableWidth.toFixed(2) );

        // Is the viewer small enough to be considered to be on a mobile/ handheld device? 
        if ( unscaledViewport.width + 150 > browserUseableWidth || viewer.dataset.expand == '1' || viewer.dataset.fit == 'fit' ) {
            // Yes, change to mobile mode using page fit as the scale.
            mode  = 'page-fit';
            scale = parseFloat( ( browserUseableWidth / unscaledViewport.width ).toFixed(1) );
        }
        
        var viewport = PDFPageProxy.getViewport( { scale: scale } );
        var style = 'width: ' + viewport.width + 'px; height: ' + viewport.height + 'px;';

        var page = document.createElement('DIV');
        page.classList.add('page');
        page.dataset.pageNumber = PDFPageProxy.pageNumber;
        page.ariaLabel = 'Page ' + PDFPageProxy.pageNumber;
        page.setAttribute( 'role', 'region' );
        page.setAttribute( 'style', style );

        var canvasWrapper = document.createElement('DIV');
        canvasWrapper.classList.add('canvas-wrapper');
        canvasWrapper.setAttribute( 'style', style );

        var canvas = document.createElement('CANVAS');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.setAttribute( 'style', style );
        canvasWrapper.appendChild( canvas );

        var textLayer = document.createElement('DIV');
        textLayer.classList.add('text-layer');
        textLayer.setAttribute( 'style', style );

        var annotationLayer = document.createElement('DIV');
        annotationLayer.classList.add('annotation-layer');
        annotationLayer.setAttribute( 'style', style );

        page.appendChild( canvasWrapper );
        page.appendChild( textLayer );
        page.appendChild( annotationLayer );

        viewer.appendChild( page );

        if ( PDFPageProxy.pageNumber == 1 ) {
            var zoomCtl = viewer.parentElement.querySelector('.pdf-resize-toolbar');
            var styles  = window.getComputedStyle( page );
            var margin  = styles.marginBottom.replace( /\D+/g, '' );
            viewer.dataset.scroll = viewer.dataset.scroll + ':' + viewport.height + ':' + margin;
            zoomCtl.classList.add( mode );
        }

// ===================================  
        var renderContext = {
            canvasContext: canvas.getContext('2d'),
            viewport: viewport,
            renderInteractiveForms: true
        };
        PDFPageProxy.render( renderContext );

        PDFPageProxy.getTextContent().then(
            renderTextLayer.bind( null, textLayer, PDFPageProxy.streamTextContent(), viewport ),
            function( error ) {
                console.error( error );
            }
        );

        PDFPageProxy.getAnnotations().then(
            renderAnnotationLayer.bind( null, annotationLayer, viewport, PDFPageProxy.pageNumber ),
            function( error ) {
                console.error( error );
            }
        );
    };

    var reloadPage = function( viewer, PDFPageProxy ) {

        // Start in desktop mode using an approximation of actual size as the scale.
        var scale = 1.5;
        var mode  = 'page-actual';
        var unscaledViewport = PDFPageProxy.getViewport( { scale: 1 } );
        var browserUseableWidth = viewer.offsetWidth - getScrollbarWidth() * 3;
        browserUseableWidth = parseFloat( browserUseableWidth.toFixed(2) );

        // Is the viewer small enough to be considered to be on a mobile/ handheld device? 
        if ( unscaledViewport.width + 150 > browserUseableWidth || viewer.dataset.expand == '1' || viewer.dataset.fit == 'fit' ) {
            // Yes, change to mobile mode using page fit as the scale.
            mode  = 'page-fit';
            scale = parseFloat( ( browserUseableWidth / unscaledViewport.width ).toFixed(1) );
        }

        // Now add in or subtract zoom.
        var zoom = parseFloat( viewer.dataset.zoom );
        if ( ! zoom ) {
            zoom = 0;
        }
        scale += zoom;
        
        var viewport = PDFPageProxy.getViewport( { scale: scale } );
        var style = 'width: ' + viewport.width + 'px; height: ' + viewport.height + 'px;';

        var page = viewer.querySelector('.page[data-page-number="' + PDFPageProxy.pageNumber + '"]');
        page.setAttribute( 'style', style );

        // Update scroll information.
        if ( PDFPageProxy.pageNumber == 1 ) {
            var zoomCtl = viewer.parentElement.querySelector('.pdf-resize-toolbar');
            var padding = viewer.dataset.scroll.split(':')[0];
            var styles  = window.getComputedStyle( page );
            var margin  = styles.marginBottom.replace( /\D+/g, '' );
            viewer.dataset.scroll = padding + ':' + viewport.height + ':' + margin;
            zoomCtl.classList.add( mode );
        }

        var canvasWrapper = page.querySelector('.canvas-wrapper');
        canvasWrapper.setAttribute( 'style', style );

        var oldCanvas = canvasWrapper.querySelector('canvas');
        var newCanvas = document.createElement('CANVAS');
        newCanvas.height = viewport.height;
        newCanvas.width = viewport.width;
        newCanvas.setAttribute( 'style', style );
        canvasWrapper.removeChild( oldCanvas );
        canvasWrapper.appendChild( newCanvas );

        var textLayer = page.querySelector('.text-layer');
        textLayer.setAttribute( 'style', style );
        textLayer.innerHTML = '';

        var annotationLayer = page.querySelector('.annotation-layer');
        annotationLayer.setAttribute( 'style', style );
        annotationLayer.innerHTML = '';
 
        var renderContext = {
            canvasContext: newCanvas.getContext('2d'),
            viewport: viewport,
            renderInteractiveForms: true
        };
        PDFPageProxy.render( renderContext );

        PDFPageProxy.getTextContent().then(
            renderTextLayer.bind( null, textLayer, PDFPageProxy.streamTextContent(), viewport ),
            function( error ) {
                console.error( error );
            }
        );

        PDFPageProxy.getAnnotations().then(
            renderAnnotationLayer.bind( null, annotationLayer, viewport, PDFPageProxy.pageNumber ),
            function( error ) {
                console.error( error );
            }
        );
    };

    var renderAnnotationLayer = function( annotationLayer, viewport, page, annotationsData ) {
        var previousDest = '';
        var previousLeft = 0;
        var currentHash  = '';
        for ( var i = 0; i < annotationsData.length; i++ ) {
            var data = annotationsData[i];
            var width = ( data.rect[2] - data.rect[0] ) * viewport.scale;
            var height = ( data.rect[3] - data.rect[1] ) * viewport.scale;
            var top = viewport.height - ( data.rect[3] * viewport.scale );
            var left = data.rect[0] * viewport.scale;

            if ( data.subtype.toUpperCase() == 'LINK' && data.dest ) {
                currentHash = data.dest[0].num + ':' + data.dest[2] + ':' + data.dest[3];
                // Correct dims
                if ( previousDest == currentHash ) {
                    width -= previousLeft - left;
                    left   = previousLeft;
                } else {
                    previousDest = currentHash;
                    previousLeft = left;
                }
            }

            var html = getAnnotationHTML( data );

            if ( ! html[1] ) {
                html[1] = 'link-annotation';
            }

            var section = document.createElement('SECTION');
            section.dataset.annotationId = data.id;
            section.setAttribute( 'class', html[1] );
            section.setAttribute( 'style', 'width: ' + width + 'px; height: ' + height + 'px; top: ' + top + 'px; left: ' + left + 'px;' );
            section.appendChild( html[0] );
            annotationLayer.appendChild(section);
        }
    };

    var renderBookmarks = function( container, bookmarks ) {
        if ( bookmarks && bookmarks.length > 0 ) {
            var results = renderBookmarksRecursively( bookmarks );
            var outline = document.createElement('DIV');
            outline.classList.add('pdf-outline');
            outline.innerHTML = results;
            outline.addEventListener( 'click', goToBookmark );
            outline.addEventListener( 'click', toggleBookmarkSubMenu );
            container.appendChild( outline );
        } else {
            // Hide bookmark toolbar button.
            var button = container.querySelector('.pdf-main-toolbar .bookmark');
            button.style.display = 'none';
        }
    };

    var renderBookmarksRecursively = function( bookmarks ) {
        if ( bookmarks.length < 1 ) {
            return '';
        }
        var results = '<ul>';
        for ( var i = 0; i < bookmarks.length; i++ ) {
            results += '<li>';
            if ( bookmarks[i].items.length > 0 ) {
                results += '<div class="toggle"><div class="close">' + ICON.caretRight + '</div><div class="open">' + ICON.caretDown + '</div></div>';
            }
            if ( bookmarks[i].url ) {
                // External link.
                results += '<a href="' + bookmarks[i].url + '" target="_blank" rel="noreferrer noopener">';
                results += bookmarks[i].title + '</a>';
            } else {
                if ( bookmarks[i].dest ) {
                    // Internal link.
                    results += '<a href="#' + encodeURIComponent( JSON.stringify( bookmarks[i].dest ) ) + '" target="_self">';
                    results += bookmarks[i].title + '</a>';
                } else {
                    // Bookmark heading.
                    results += '<div class="heading">' + bookmarks[i].title + '</div>';
                }
            }
            results += renderBookmarksRecursively( bookmarks[i].items );
            results += '</li>';
        }
        return results + '</ul>';
    };

    var renderTextLayer = function( textLayer, stream, viewport, textContent ) {
        pdfjsLib.renderTextLayer( {
            textContent: textContent,
            textContentStream: stream,
            container: textLayer,
            viewport: viewport,
            textDivs: [],
            textContentItemsStr: [],
            timeout: 0,
            enhanceTextSelection: true
        } );
    };

    var rerenderPDF = function ( id ) {
        var pdf = PDFS[id];
        if ( pdf ) {
            // Setup needed variables.
            var pdfElem = document.getElementById( id );
            var viewer  = pdfElem.querySelector('.pdf-viewer');
            var pages   = pdfElem.querySelector('.pdf-main-toolbar .current-page');
            var current = parseInt( pages.value );
            var lower   = current;
            var upper   = current;
            var max     = pages.max;
            var running = true;

            // Reload the current page first.
            pdf.getPage( current ).then(
                reloadPage.bind( null, viewer ),
                function( error ) {
                    console.error( error );
                }
            );

            // Loop through the remaining pages.
            while( running ) {
                running = false;
                // Check for lower page.
                if ( lower - 1 > 0 ) {
                    lower--;
                    running = true;
                    pdf.getPage( lower ).then(
                        reloadPage.bind( null, viewer ),
                        function( error ) {
                            console.error( error );
                        }
                    );
                }
                // Check for upper page.
                if ( upper + 1 <= max ) {
                    upper++;
                    running = true;
                    pdf.getPage( upper ).then(
                        reloadPage.bind( null, viewer ),
                        function( error ) {
                            console.error( error );
                        }
                    );
                }
            }
        }
    };

    var throttle = function( func, delay ) {
        delay = delay || 250;
        var hash = 'F' + getStringHash( func.toString() );
        if ( ! THROTTLE_FUNC[ hash ] ) {
            THROTTLE_FUNC[ hash ] = [ func, delay, Date.now(), event ];
            return function() {
                throttle( func, delay );
                THROTTLE_FUNC[ hash ][3] = event;
                if ( THROTTLE_TIMER[ hash ] ) {
                    clearTimeout( THROTTLE_TIMER[ hash ] );
                }
                THROTTLE_TIMER[ hash ] = setTimeout( throttle.bind( null, func, delay ), delay );
            }
        } else {
            if ( Date.now() > THROTTLE_FUNC[ hash ][1] + THROTTLE_FUNC[ hash ][2] ) {
                if ( THROTTLE_FUNC[ hash ][3].type == 'message' ) {
                    THROTTLE_FUNC[ hash ][3] = event;
                }
                THROTTLE_FUNC[ hash ][0].call( null, THROTTLE_FUNC[ hash ][3] );
                THROTTLE_FUNC[ hash ][2] = Date.now();
            }
        }
    };

    var toggleBookmarkSubMenu = function() {
        if ( event.path ) {
            for ( var i = 0; i < event.path.length; i++ ) {
                if ( event.path[i].classList.contains('toggle') ) {
                    event.preventDefault();
                    event.path[i].parentElement.classList.toggle('open');
                    return;
                }
                if ( event.path[i].classList.contains('pdf-outline') ) {
                    break;
                }
            }
        }
    };
    
    /**
     * Generate a fairly unique ID for use as an HTML ID.
     * {@link https://gist.github.com/gordonbrander/2230317#gistcomment-1713405|Source}
     * 
     * @return {String} A 14 character unique ID.
     */
    var uid = function() {
        return ( Date.now().toString(36) + Math.random().toString(36).substr(2, 6) ).toUpperCase();
    };

    return {
        'initialize': initialize
    };

} )();
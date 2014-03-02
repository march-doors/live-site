/* global jQuery */

/*

Contextually Aware Images 1.0 (cta-images)
==========================================
Copyright Tom Allen 2013

Credit to Anders Andersen & Tobias Järlund (for the intrinsic ratio idea)
http://mobile.smashingmagazine.com/2013/09/16/responsive-images-performance-problem-case-study/

& to Mairead (for the <noscript> idea)
http://www.headlondon.com/our-thoughts/technology/posts/creating-responsive-images-using-the-noscript-tag

Thanks to Paul Irish for the use of his debounce function 
http://www.paulirish.com/2009/throttled-smartresize-jquery-event-handler/

Creative Commons CC0.
http://creativecommons.org/publicdomain/zero/1.0/

Date: Monday 18 November 2013

*/

/*


## JS API documentation

All data for images is stored in noscript tags, wrapping the fallback image.
Data-attributes are extracted and the most appropriate image source is selected
based on the noscript element's parent width. Image srcs are stored as json key
value pairs in the attribute 'data-srcs', keyed by the source image's width.

The script will also respond to subsequent changes in the image dimensions,
swapping out larger versions of the image if necessary. Larger images will not
be swapped for smaller ones.

The 'data-load-trigger' determines when the image is loaded, options are
'lazy_load', 'document_ready' or 'external_trigger'. If external trigger is
used, the image can be loaded by calling
cta_images.external_load_trigger(image_id[, fade_time][, callback]).

### Other exposed functions:

- cta_images.allow_lazy_load_trigger(bool); - this can be used to block lazy
loading, for example if using an animated scroll, you might wish to block lazy
loading until the scroll has finished. You would do this by calling
'cta_images.allow_lazy_load_trigger(false);', before scrolling, and then calling
'cta_images.allow_lazy_load_trigger(true);', once scrolling has finished. 
- cta_images.update_image_logic(); - this will trigger the script that checks
whether the current image is the correct size or whether a larger src needs to
be loaded. This triggers on resizing the browser window by default, but you may
wish to re-trigger if you are resizing an image on the page. 

### Options

- Load trigger: 'Lazy Load', 'On Document Ready', 'On External Trigger'
- Wrapper Element: 'none', 'div', 'span'
- Intrinsic Ratio: y/n
- Image fade time: 0 - 1500
- Image styles: select from available image styles
- Standard display resolution multiplier: 1 - 2 or 'auto'
- Retina display resolution multiplier: 1 - 2 or 'auto'
- No JS fallback style: select from available image styles
- Provide image fallback link: y/n

*/


/**
 * Paul Irish's Debounced Resize() jQuery Plugin.
 *
 * Paul Irish - Creative Commons CC0 2009.
 *
 * Debounces updating of current img src when resizing browser, this saves
 * loading unnecessary interim images.
 * 
 * Conditionally loaded to avoid conflict if plugin is declared elsewhere.
 */
if (!jQuery(window).smartresize) {

  (function($,sr){

    // debouncing function from John Hann.
    // http://unscriptable.com/index.php/2009/03/20/debouncing-javascript-methods/
    var debounce = function (func, threshold, execAsap) {
        var timeout;

        return function debounced () {
            var obj = this, args = arguments;
            function delayed () {
                if (!execAsap)
                    func.apply(obj, args);
                timeout = null;
            };

            if (timeout)
                clearTimeout(timeout);
            else if (execAsap)
                func.apply(obj, args);

            timeout = setTimeout(delayed, threshold || 100);
        };
    }
    // smartresize.
    jQuery.fn[sr] = function(fn){  return fn ? this.bind('resize', debounce(fn)) : this.trigger(sr); };

  })(jQuery,'smartresize');
}
/**
 * @file
 * Handles loading of images and exposes external API.
 */

cta_images = (function () {

  // Plugin wide variables.
  var images_data = {},
      is_retina,
      device_resolution,
      images_on_page,
      allow_lazy_load = true,
      default_fade_in_time = 300,
      image_id_counter = 0,
      drupal_cta_images_js_data = false,
      default_load_trigger = 'lazy_load';

  /**
   * Initialise plugin.
   */
  function init() {
    if (jQuery('.cta_images_noscript').length) {

      detect_retina();

      images_on_page = true;

      // Test for drupal data & if drupal image ids exist, update
      // image_id_counter.
      update_image_id_counter();

      var $target_noscript_els = jQuery('.cta_images_noscript');

      $target_noscript_els.each(function (i) {

        // Get image.
        var $this_noscript_el = jQuery(this);

        // Calculate current image id.
        var image_id = get_image_id($this_noscript_el);

        // Save image data attributes to image_data object.
        var image_data = get_image_data(image_id, $this_noscript_el);

        // Save image_data object to images_data object, keyed by id.
        images_data[image_id] = image_data;

        // Calculate image width.
        var image_width = $this_noscript_el.parent().width();

        // Add current src to image_data object. This has to be done after
        // initially saving 'image_data' to 'images_data', so that the
        // 'non_retina_multiplier' & 'retina_multiplier' image properties are
        // available to the 'calculate_src' function
        image_data['current_src'] = calculate_src(image_data['srcs'], image_width, image_id);

        // Re-save 'image_data' object to 'images_data'.
        images_data[image_id] = image_data;

        // If load_trigger is 'document_ready', then add_image_to_dom.
        if (image_data['load_trigger'] === 'document_ready') {
          add_image_to_dom(image_data);
        }
      });

      // Bind Events.
      bind_events();
    }
  }

  /**
   * Utility function to compile an array of classes into a string.
   */
  function compile_attributes(array) {
    var string = array.join(' ');
    return string;
  }

  /**
   * Test for existence of Drupal.settings.cta_images object, and update 
   * image_id_counter.
   *
   * We need to keep an image counter in js, as there could be a mixture of
   * images where the id has been set by drupal, and images without ids, for
   * images without ids, we need to set one via javascript.
   */
  function update_image_id_counter() {
    if (typeof Drupal === undefined) {
      if (Drupal !== null) {
        if (Drupal.hasOwnProperty('settings')) {
          if (Drupal.settings.hasOwnProperty('cta_images')) {
            drupal_cta_images_js_data = true;
          }
        }
      }
    }
    if (drupal_cta_images_js_data) {
      image_id_counter = Drupal.settings.cta_images.last_image_id;
    }
  }

  /**
   * Get ID of current image.
   */
  function get_image_id($this_noscript_el) {
    // Look for image id on element.
    if ($this_noscript_el.attr('data-image-id')) {
      image_id = parseInt($this_noscript_el.attr('data-image-id'), 10);
    }
    else {
      // Increment counter, and then set as current image_id.
      image_id_counter ++;
      image_id = image_id_counter;
      // Set image id.
      $this_noscript_el.attr('data-image-id', image_id);
    }
    return image_id;
  }

  /**
   * Sort the srcs object by image size.
   */
  function sort_srcs(srcs) {
    // Create temporary srcs array.
    var srcs_temp_array = [];

    // Cycle images in srcs object.
    for (var image_width in srcs) {
      var src = srcs[image_width];
      image_width = parseInt(image_width, 10);
      var data = {
        'image_width': image_width,
        'src': src,
      }
      srcs_temp_array[image_width] = data;
    }

    // Sort array of srcs.
    srcs_temp_array.sort(function (a, b) {
      return(a, b);
    });

    // Reset srcs object.
    srcs = {};

    // Add srcs to srcs object, now in image_width order.
    for (var id in srcs_temp_array) {
      var data = srcs_temp_array[id];
      srcs[data['image_width']] = data['src'];
    }

    return srcs;
  }

  /**
   * Get image data and return as object.
   */
  function get_image_data(image_id, $this_noscript_el) {
    // Check whether there is data corresponding to current image in
    // Drupal.settings.cta_images.
    var image_data_in_array = false;
    var this_image_drupal_data;
    var this_image_drupal_attr;
    if (drupal_cta_images_js_data) {
      if (Drupal.settings.cta_images.hasOwnProperty('images_data')) {
        if (image_id in Drupal.settings.cta_images.images_data) {
          image_data_in_array = true;
          this_image_drupal_data = Drupal.settings.cta_images.images_data[image_id];
          this_image_drupal_attr = this_image_drupal_data.tag_attributes.raw.responsive_image_attr;
        }
      }
    }

    // Declare variables.
    var srcs,
        classes,
        load_trigger = default_load_trigger,
        fade_time = default_fade_in_time,
        alt_attr = '';

    // If image_data_in_array, then we want to obtain all attributes from the
    // Drupal array, else we look for them on the <noscript> element.
    if (image_data_in_array) {
      // Get image srcs from array.
      srcs = jQuery.parseJSON(this_image_drupal_attr['data-srcs']);

      // Get classes from array.
      classes = compile_attributes(this_image_drupal_attr['data-class']);

      // Get data-load-trigger if set in array.
      if (this_image_drupal_attr['data-load-trigger'] != undefined) {
        load_trigger = this_image_drupal_data.tag_attributes.raw.responsive_image_attr['data-load-trigger'];
      }

      // Get data-fade-time from array.
      if (this_image_drupal_attr['data-fade-time'] != undefined) {
        fade_time = parseInt(this_image_drupal_attr['data-fade-time'], 10);
      }

      // Get alt text from array.
      if (this_image_drupal_attr['data-alt'] != undefined) {
        alt_attr = this_image_drupal_attr['data-alt'];
      }
    }
    else {
      // Get image srcs from element.
      srcs = jQuery.parseJSON($this_noscript_el.attr('data-srcs'));

      // Get classes from element.
      classes = $this_noscript_el.attr('data-class');

      // Get data-load-trigger if set on element.
      if ($this_noscript_el.attr('data-load-trigger') != undefined) {
        load_trigger = $this_noscript_el.attr('data-load-trigger');
      }
      
      // Get data-fade-time from element.
      if ($this_noscript_el.attr('data-fade-time') != undefined) {
        fade_time = parseInt($this_noscript_el.attr('data-fade-time'), 10);
      }

      // Get alt text from element.
      if ($this_noscript_el.attr('data-alt') != undefined) {
        alt_attr = $this_noscript_el.attr('data-alt');
      }
    }

    // Sort srcs by image size.
    srcs = sort_srcs(srcs);

    // Calculate image size multipliers for current image.
    var multipliers = calc_multipliers(image_id, image_data_in_array, this_image_drupal_attr, $this_noscript_el);

    var image_data = {
      'id' : image_id,
      'noscript_el' : $this_noscript_el,
      'load_trigger' : load_trigger,
      'classes' : classes,
      'srcs' : srcs,
      'loaded' : false,
      'fade_time' : fade_time,
      'alt' : alt_attr,
      'non_retina_multiplier' : multipliers['non_retina_multiplier'],
      'retina_multiplier' : multipliers['retina_multiplier'],
    };

    return image_data;
  }

  /**
   * Calculate image size multipliers for current image.
   */
  function calc_multipliers(image_id, image_data_in_array, this_image_drupal_attr, $this_noscript_el) {
    // Calculate base multiplier
    var non_retina_multiplier;

    if (image_data_in_array) {
      // If a data-attr is set in array, then set var to attr.
      if (this_image_drupal_attr['data-standard-display-resolution'] !== undefined) {
        non_retina_multiplier = this_image_drupal_attr['data-standard-display-resolution'];
      }
    }
    else {
      // If a data-attr is set on the <noscript> element, then set var to attr.
      if ($this_noscript_el.attr('data-standard-display-resolution') !== undefined) {
        non_retina_multiplier = $this_noscript_el.attr('data-standard-display-resolution');
      }
    }

    // Data attr could be set to 'auto', or not set at all, in which case
    // set the default
    if (non_retina_multiplier === 'auto' || non_retina_multiplier === null) {
      non_retina_multiplier = 1;
    }
    // If the retina data-attr is set to anything other than 'auto', then
    // parse that value is a float multiply by the base multiplier.
    else {
      non_retina_multiplier = parseFloat(non_retina_multiplier);
    }

    // Calculate multiplier for high dpi displays
    var retina_multiplier;

    if (image_data_in_array) {
      // If a data-attr is set in array, then set var to attr.
      if (this_image_drupal_attr['data-retina-display-resolution'] !== undefined) {
        retina_multiplier = this_image_drupal_attr['data-retina-display-resolution'];
      }
    }
    else {
      // If a data-attr is set on the <noscript> element, then set var to attr.
      if ($this_noscript_el.attr('data-retina-display-resolution') !== undefined) {
        retina_multiplier = $this_noscript_el.attr('data-retina-display-resolution');
      }
    }

    // Data attr could be set to 'auto', or not set at all, in which case
    // set the default
    if (retina_multiplier === 'auto' || retina_multiplier === null) {

      // If device_resolution has been detected (could vary dependent on
      // browser), then set the retina_multiplier to the base
      // (non_retina_multiplier) resolution * the device_resolution, else
      // set to 1.5 * the base multiplier.
      if (device_resolution !== undefined && device_resolution !== null) {
        retina_multiplier = device_resolution * non_retina_multiplier;
      }
      else {
        retina_multiplier = 1.5 * non_retina_multiplier;
      }
    }

    // If the retina data-attr is set to anything other than 'auto', then
    // parse that value is a float multiply by the base multiplier.
    else {
      retina_multiplier = parseFloat(retina_multiplier) * non_retina_multiplier;
    }

    var multipliers = [];
    multipliers['non_retina_multiplier'] = non_retina_multiplier;
    multipliers['retina_multiplier'] = retina_multiplier;

    // Return multipliers array.
    return multipliers;
  }

  /**
   * Calculate the width of an image based on its id.
   */
  function calculate_image_width(image_id) {
    var $this_noscript_el = images_data[image_id]['noscript_el'];
    var image_width = $this_noscript_el.parent().width();
    return(image_width);
  }

  /**
   * Calculate optimum image src based on available srcs and the image's width
   */
  function calculate_src(srcs, image_width, image_id) {
    var image_width = image_width;
    non_retina_multiplier = images_data[image_id]['non_retina_multiplier'];
    retina_multiplier = images_data[image_id]['retina_multiplier'];
    if (is_retina === true) {
      if (retina_multiplier) {
        image_width = image_width * retina_multiplier;
      }
    }
    else {
      if (non_retina_multiplier) {
        image_width = image_width * non_retina_multiplier;
      }
    };
    var load_src = {};
    var max_load_src = {};
    var match_found = false;
    for (style_width in srcs) {
      delete max_load_src;
      max_load_src = {};
      max_load_src['src'] = srcs[style_width], 10;
      max_load_src['width'] = parseInt(style_width, 10);
      if (parseInt(style_width, 10) >= image_width) {
        match_found = true;
        delete load_src;
        load_src = {};
        load_src = max_load_src;
        break;
      }
    }
    if (match_found === false) {
      load_src = max_load_src;
    }
    return(load_src);
  }

  /**
   * Add new image to DOM.
   */
  function add_image_to_dom(image_data, fade_in, callback) {
    if (callback === undefined) {callback = (function () {});};
    if (fade_in === undefined) {fade_in = image_data['fade_time'];}
    // Create new image.
    var image = create_image(image_data);
    var $this_noscript_el = image_data['noscript_el'];
    // Render to DOM.
    $this_noscript_el.after(image);
    // Bind fade to load.
    jQuery('.cta_images_js_image').load(function () {
      jQuery(this).fadeIn(fade_in, function () {
        callback();
      });
    });
    // Set loaded value to true for image.
    var image_id = image_data['id'];
    images_data[image_id]['loaded'] = true;
  }

  /**
   * Creates and returns the markup for a new image.
   */
  function create_image(image_data) {
    var contruct_image
      = '<img ' +
      'class="cta_images_js_image ' + image_data['classes'] + '" ' +
      'src="' + image_data['current_src']['src'] + '" ' +
      'alt="' + image_data['alt'] + '" ' +
      'data-image-id="' + image_data['id'] + '" ' +
      'style="display: none;"' +
      '>';
    return(contruct_image);
  }

  /**
   * Swaps out an old image with a new one.
   */
  function swap_out_image(image_id, optimum_src, $old_image) {
    var clone_img = $old_image.clone();
    clone_img.attr({src: optimum_src['src']});
    update_current_src_data(image_id, optimum_src);
    clone_img.bind('load', function(){
      $old_image.replaceWith(clone_img).show(0);
    });
  }

  /**
   * Updates the current src property for a given image.
   */
  function update_current_src_data(image_id, src) {
    images_data[image_id]['current_src'] = src;
  }

  /**
   * Utility, triggered by init.
   *
   * Detects whether the display is high dpi, and returns a bool (is_retina) and
   * an integer (device_resolution).
   */
  function detect_retina() {
    is_retina = (
      window.devicePixelRatio > 1 ||
      (window.matchMedia && window.matchMedia("(-webkit-min-device-pixel-ratio: 1.5),(-moz-min-device-pixel-ratio: 1.5),(min-device-pixel-ratio: 1.5)").matches)
    );
    device_resolution = window.devicePixelRatio;
  }

  /**
   * Lazy load.
   */
  function lazy_load() {
    if (allow_lazy_load === true) {
      for (var image_id in images_data) {
        var image_data = images_data[image_id];
        if (image_data['load_trigger'] === 'lazy_load' && image_data['loaded'] === false) {
          if (lazy_load_logic(image_id) === true) {
            add_image_to_dom(image_data);
          }
        }
      }
    }
  }

  /**
   * Calculates whether an image is in view, and therefore whether it should be
   * loaded.
   */
  function lazy_load_logic(image_id) {
    var $this_noscript_el = images_data[image_id]['noscript_el'];
    var $this_noscript_el_parent = $this_noscript_el.parent();

    var windowHeight    = jQuery(window).height();
    var el              = $this_noscript_el_parent,
      offset          = el.offset(),
      scrollTop       = jQuery(window).scrollTop();

    // If the image is within half a screen's height of being in view then
    // return true.
    if ((scrollTop + (windowHeight * 1.5) > offset.top) && (scrollTop - windowHeight < offset.top + el.height())) {
      if ($this_noscript_el_parent.is(':visible')) {
        return true;
      }
      else {
        return false;
      }
    }
    else {
      return false;
    }
  }

  /**
   * Bind events.
   *
   * Lazy loading must be bound to scroll events, and update_image_logic should
   * be re-triggered on resizing the window.
   */
  function bind_events() {
    lazy_load();
    jQuery(window).scroll(function () {
      lazy_load();
    });
    if (jQuery(window).smartresize) {
      jQuery(window).smartresize(function () {
        update_image_logic();
      });
    } else {
      jQuery(window).resize(function () {
        update_image_logic();
      });
    }
  }

  /**
   * Update image.
   *
   * Triggered on resizing the browser window. Also made available externally.
   *
   * Would need to be re-triggered manually after manually changing the size of
   * an image.
   */
  function update_image_logic() {
    for (image_id in images_data) {
      // Calculate image width.
      var image_width = calculate_image_width(image_id);
      // Get sources data for current image.
      var srcs = images_data[image_id]['srcs'];
      var optimum_src = calculate_src(srcs, image_width, image_id);
      var current_src = images_data[image_id]['current_src'];
      // Test for whether the js version of the image has been created.
      if (jQuery('.cta_images_js_image[data-image-id="' + image_id + '"]').length) {
        // Detect whether image should be swapped out with larger image.
        if (parseInt(optimum_src['width'], 10) > parseInt(current_src['width'], 10)) {
          var $this_image = jQuery('.cta_images_js_image[data-image-id="' + image_id + '"]');
          swap_out_image(image_id, optimum_src, $this_image);
        }
      }
      else {
        // Update the optimum source in the images_data array.
        update_current_src_data(image_id, optimum_src);
      }
    }
  }

  /**
   * Exposed function to load image from id.
   *
   * cta_images.external_load_trigger(image_id[, fade_time][, callback])
   *
   * If 'external_trigger' is selected as the load trigger, the loading of the
   * image can be triggered by calling cta_images.external_load_trigger(). The
   * function requires the id of the image to load as the first variable, and
   * can optionally be passed a fade time, and a callback function. Fade time
   * can be set to 'default'.
   *
   */
  function external_load_trigger(image_id, fade_in, callback) {
    if (images_on_page) {
      var image_data = images_data[image_id];
      // Handle defaults.
      if (callback === undefined) {callback = (function () {});};
      if (fade_in === undefined || fade_in === 'default') {fade_in = image_data['fade_time'];}

      if (image_data['loaded'] === false) {
        add_image_to_dom(image_data, fade_in, callback);
      }
      else {
        callback();
      }
    }
  }

  /**
   * Exposed function to block or allow lazy loading.
   *
   * allow_lazy_load_trigger(bool)
   *
   * Lazy loading is allowed by default. If 
   * cta_images.allow_lazy_load_trigger(false) is called externally, lazy
   * loading will be blocked until cta_images.allow_lazy_load_trigger(true) is
   * called. Calling cta_images.allow_lazy_load_trigger(true) will also trigger
   * a re-check of all images, and load any that are now in view.
   */
  function allow_lazy_load_trigger(bool) {
    if (bool === true) {
      allow_lazy_load = true;
      lazy_load();
    }
    else {
      allow_lazy_load = false;
    }
  }

  /**
   * Return exposed functions to make available externally.
   */
  return {
    init: init,
    allow_lazy_load_trigger: allow_lazy_load_trigger,
    external_load_trigger: external_load_trigger,
    update_image_logic: update_image_logic
  };
})();

jQuery(window).load(function () {
  cta_images.init();
});

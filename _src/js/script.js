var march_doors_js = {};

march_doors_js.resize_slide_img = (function(){
  function init(){
    if($('.bg-slides .slide').length){
      resize();
      bind_events();
    }
  }
  function resize(){
    var $container = $('.bg-slides .slide');
    var container_height = $container.outerHeight(true);
    var container_width = $container.outerWidth(true);
    var container_aspect_ratio = container_height/container_width;

    var $image = $container.find('img');
    var image_height = $image.outerHeight(true);
    var image_width = $image.outerWidth(true);
    var image_aspect_ratio = image_height / image_width;

    var left_pos;
    var top_pos;

    if (container_aspect_ratio > image_aspect_ratio) {
      $image.addClass('match-height');
      image_width = $image.outerWidth(true);
      left_pos = (container_width - image_width) / 2;
      $image.css('left', left_pos + 'px');
      top_pos = 0;
      $image.css('top', top_pos + 'px');
    }
    else {
      $image.removeClass('match-height');
      image_height = $image.outerHeight(true);
      left_pos = 0;
      $image.css('left', left_pos + 'px');
      top_pos = (container_height - image_height) / 2;
      $image.css('top', top_pos + 'px');
    }
  }
  function bind_events(){
    $('.bg-slides .slide img').load(function() {
      ounce_js.resize_homepage_img.init();
    });
    $(window).resize(function() {
      resize();
    });
  }
  return {
    init: init
  };
})();

$(window).load(function(){
  march_doors_js.resize_slide_img.init();
});

// ==UserScript==
// @name           youtube.com ui tweaks
// @namespace      com.youtube.tweaks.ui
// @require        http://code.jquery.com/jquery-2.1.3.min.js
// @include        http://*.youtube.com/*
// @include        https://*.youtube.com/*
// @noframes
// ==/UserScript==

// run once when the script it loaded
console.log('loaded: com.youtube.tweaks.ui');

String.prototype.format = function() {
  var args = arguments;
  if (typeof args[0] === 'object')
    args = args[0];
  return this.replace(/\{\{([a-z0-9_]+)\}\}/g, function(match, name) { 
    return args[name] !== undefined
      ? args[name]
      : match
    ;
  });
};

(function() {
  
  var rate_limit_call = function(func, context) {
    return function() {
      func.__rate_limit = false;
      func.call(context);
    };    
  };
  
  var rate_limit = function(func, time, context) {
    if (func.__rate_limit === true) return;
    func.__rate_limit = true;
    var timed = rate_limit_call(func, context);
    func.__rate_limit_timer = window.setTimeout(timed, time);
  };
  
  var rate_limit_reset = function(func) {
    if (func.__rate_limit_timer !== undefined)
      window.clearTimeout(func.__rate_limit_timer);
    func.__rate_limit_timer = undefined;
    func.__rate_limit = false;
  };
  
  window.rate_limit = rate_limit;
  window.rate_limit_reset = rate_limit_reset;
  
})();

var player;
var _player;
var first_execute = true;
var has_feature_enabled = {};
var is_watch_fill_enabled = false;

var execute_tweaks = function() {

  // run once when the script it executed
  // * this can run several times due to pushState url changes
  console.log('executed: com.youtube.tweaks.ui');

  // body element so we can track which
  // things have run already
  var body = $('body');

  // --------------------------------------------------------------------
  // ---------------- access player functionality -----------------------
  // --------------------------------------------------------------------

  (function() {

    if (has_feature_enabled['player']) return;

    try {
      _player = $('#movie_player');
      if (!_player.length) return;
      player = _player.get(0);
    } catch (e) {
      return;
    }

    var progress_bar = $('<div id="progress-bar">\
        <div id="pb-base-status"></div>\
        <div id="pb-load-status"></div>\
        <div id="pb-play-status"></div>\
      </div>');

    var old_progress_bar = $('.ytp-progress-bar-container');
    old_progress_bar.replaceWith(progress_bar);
    var pb_hover = $('#pb-play-status');
    var pb_play_status = $('#pb-play-status');    
    var pb_load_status = $('#pb-load-status');

    var ctrl_mo_data = {};
    var ctrl_mo_handler = function() {
      if (ctrl_mo_data.timeout) clearTimeout(ctrl_mo_data.timeout);
      ctrl_mo_data.timeout = setTimeout(ctrl_mo_handler.expired, 1000);
      if (ctrl_mo_data.hasClass) return;
      progress_bar.addClass('extended');
      ctrl_mo_data.hasClass = true;
    };

    ctrl_mo_handler.expired = function() {
      progress_bar.removeClass('extended');
      ctrl_mo_data.hasClass = false;
    };

    $(document)
      .off('mouseover.PBcontrols')
       .on('mouseover.PBcontrols', '.html5-video-controls', function(ev) {
      rate_limit(ctrl_mo_handler, 100);
    });

    var pb_mouse_down = 1;
    var pb_offset_x;
    var pb_width;

    var pb_seek = function(page_x, allow_load) {
      var seek_x = page_x - pb_offset_x;
      var ratio = seek_x / pb_width;
      var seek_to = ratio * player.getDuration();
      var percent_str = ('{{0}}%'.format(100 * ratio));
      pb_play_status.css('width', percent_str);
      player.seekTo(seek_to, allow_load);
    };

    var pb_mousemove = function() {
      pb_seek(this.pageX, false);
    };

    $(document)
      .off('mousedown.PB')
       .on('mousedown.PB', '#progress-bar', function(ev) {

      pb_mouse_down = true;
      pb_offset_x = progress_bar.offset().left;
      pb_width = progress_bar.width();
      console.log(pb_offset_x, pb_width);
      pb_seek(ev.pageX, false);
      player.pauseVideo();

      $(document)
        .off('mousemove.PB')
         .on('mousemove.PB', function(ev) {
        if (!pb_mouse_down) return;
        rate_limit(pb_mousemove, 50, ev);
      });

      $(document)
        .off('mouseup.PB')
         .on('mouseup.PB', function(ev) {
        pb_mouse_down = false;
        pb_seek(ev.pageX, true);
        player.playVideo();
        $(document).off('mousemove.PB');
        $(document).off('mouseup.PB');
      });

    });

    (function() {
      if (!player) return;
      var play_now = player.getCurrentTime();
      var play_max = player.getDuration();
      var play_ratio = play_now / play_max;
      var play_percent_str = ('{{0}}%'.format(100 * play_ratio));
      pb_play_status.css('width', play_percent_str);
      var load_now = player.getVideoBytesLoaded();
      var load_max = player.getVideoBytesTotal();
      var load_ratio = load_now / load_max;
      var load_percent_str = ('{{0}}%'.format(100 * load_ratio));
      pb_load_status.css('width', load_percent_str);      
      seekbar_timeout = setTimeout(arguments.callee, 100);
    })();

    has_feature_enabled['player'] = true;

  })();

  // --------------------------------------------------------------------
  // ------------------- default to the subscriptions -------------------
  // --------------------------------------------------------------------
    
  $('#logo-container').attr('href', '/feed/subscriptions');
  if (first_execute && window.location.pathname === '/' && 
    window.location.search.length === 0) {
    window.location.pathname = '/feed/subscriptions';
    return;
  }

  // --------------------------------------------------------------------
  // ------------------- remove notification icon -----------------------
  // --------------------------------------------------------------------

  if (first_execute)
    $('#sb-button-notify').remove();

  // --------------------------------------------------------------------
  // ------------------- nicer subscriptions page -----------------------
  // --------------------------------------------------------------------

  (function() {

	if (has_feature_enabled['subs_page']) return;

    // test if subs code has been loaded: no ==> nevermind
    var right_side = $('.branded-page-related-channels');
    var guide_subs = $('#guide-subscriptions-section');
    if (!right_side.length) return;
    if (!guide_subs.length) return;

    var manage = $('#gh-management').detach();

    right_side.filter(':gt(0)').remove();
    right_side.empty();

    guide_subs.before(manage);
    guide_subs.children('h3').remove();

    var div_subs = $('<div></div>');
    div_subs.attr('id', guide_subs.attr('id'));
    div_subs.attr('class', guide_subs.attr('class'));
    div_subs.append(guide_subs.children().detach());
    right_side.append(div_subs);

    div_subs.find('hr').remove();
    div_subs.find('#guide-channels')
      .removeClass('yt-uix-scroller')
      .css('max-height', 'none');        
    div_subs.find('a.guide-item > .guide-count')
      .css('color', '#fff');  
    

    div_subs.find('a.guide-item').each(function() {
      this.href += '/u';
    });

    $('span.guide-management-plus-icon').parent()
      .css('padding-left', '4px').end().remove();        
    $('span.guide-management-settings-icon').parent()
      .css('padding-left', '4px').end().remove();        
    $('#guide-main .guide-module-content')
      .css('margin-bottom', '10px');

    var top_guide = $('.guide-section:first .guide-user-links');
    var clone = top_guide.children().eq(0).clone();
    clone.find('.display-name').children('span').text('Music');
    clone.find('.thumb').removeClass('guide-what-to-watch-icon')
      .addClass('guide-music-icon');
    clone.find('a').attr('href', '/feed/music');
    top_guide.append(clone);

    var liked_videos = $('.guide-channels-list .guide-likes-playlist-icon')
      .parents('li.guide-channel');
    liked_videos.parent().prepend(liked_videos);

    has_feature_enabled['subs_page'] = true;

  })();

  // --------------------------------------------------------------------
  // ---------------- set high quality video ----------------------------
  // --------------------------------------------------------------------

  if (player) player.setPlaybackQuality('hd1080');

  // --------------------------------------------------------------------
  // ---------------- video player fill size ----------------------------
  // --------------------------------------------------------------------

  (function() {

    // change page? add it again
    if (is_watch_fill_enabled) {
      _player.removeClass('ideal-aspect');
      body.addClass('watch-fill');
    }

    if (has_feature_enabled['video_fill']) return;

    // test if player code has been loaded: no ==> nevermind
    var fullscreen_button = $('.ytp-fullscreen-button');
    if (!fullscreen_button.length) return;
    
    var isFullScreen = function() {
      return document.mozFullScreen
        || document.webkitIsFullScreen
        || document.fullscreenElement 
        || document.mozFullScreenElement 
        || document.webkitFullscreenElemen;
    };

    var exitFullScreen = function() {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        var fscEvent = new Event('fullscreenchange');
        document.dispatchEvent(fscEvent);
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
        var fscEvent = new Event('mozfullscreenchange');
        document.dispatchEvent(fscEvent);
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
        var fscEvent = new Event('webkitfullscreenchange');
        document.dispatchEvent(fscEvent);
      }
    };

    var handleFullScreen = function() {
      if (isFullScreen()) {
        if (is_watch_fill_enabled) {
          body.removeClass('watch-fill');
          is_watch_fill_enabled = false;
        }
      }
    };

    $(document).on('fullscreenchange', handleFullScreen);
    $(document).on('mozfullscreenchange', handleFullScreen);
    $(document).on('webkitfullscreenchange', handleFullScreen);

    var clone = fullscreen_button.clone();
    clone.removeClass('ytp-fullscreen-button');
    clone.addClass('ytp-button-watch-fill'); 
    clone.attr('aria-label', 'Fill window');
    clone.attr('title', 'Fill window');
    var rect = document.createElement('rect');
    var rect = $(rect);
    rect.attr('width', '12');
    rect.attr('height', '6');
    rect.attr('x', '12');
    rect.attr('y', '15');
    var svg = clone.find('svg');
    svg.html(svg.html() + '<rect x=13 y=16 height=4 width=10 fill=#fff />');
    fullscreen_button.after(clone);
    clone.on('click', function() {
      if (is_watch_fill_enabled) {
        body.removeClass('watch-fill');
        is_watch_fill_enabled = false;
      } else {
        if (isFullScreen()) exitFullScreen();
        _player.removeClass('ideal-aspect');
        body.addClass('watch-fill');
        is_watch_fill_enabled = true;
      }
    });

    var change_size_button = $('.ytp-size-toggle-large');
    if (!change_size_button.length)
      change_size_button = $('.ytp-size-toggle-small');
    change_size_button.on('click', function() {
      body.removeClass('watch-fill');
      is_watch_fill_enabled = false;
    });

    has_feature_enabled['video_fill'] = true;

  })();

  // --------------------------------------------------------------------
  // ---------------- improvements to the watch ui ----------------------
  // --------------------------------------------------------------------

  // remove those nasty comments!
  // $('#watch-discussion').remove();

  // --------------------------------------------------------------------
  // --------------------------------------------------------------------

  first_execute = false;

};

// --------------------------------------------------------------------
// ------------ detect url change and execute stuff -------------------
// --------------------------------------------------------------------

var detect_load_finish = function() {
  var progress_bar = document.getElementById('progress');
  if (!progress_bar) return execute_tweaks();
  setTimeout(detect_load_finish, 50);
};

var __location = window.location.href;
setTimeout(function() {
  if (__location !== window.location.href)
    setTimeout(detect_load_finish, 50);
  setTimeout(arguments.callee, 50);
  __location = window.location.href;
}, 50);

setTimeout(execute_tweaks, 0);

// --------------------------------------------------------------------
// ------------------ attach default tweaks css -----------------------
// --------------------------------------------------------------------

$('head').append('<style>\
  .feed-author-bubble-container{display:none;}\
  .feed-item-container .feed-item-main{margin-left:0;}\
  .feed-item-container.legacy-style .feed-item-main{margin-left:0;}\
  #guide-main .personal-item .guide-item{padding-right:20px;text-align:right;}\
  #guide-main .personal-item .guide-item .thumb{display:none;}\
  #guide-subscriptions-section h3{display:none;}\
  #guide-subs-footer-container{padding:2px 0 8px;}\
  .guide-sort-container{display:none;}\
  .guide-quick-filter{width:145px!important;}\
  .guide-count{display:none;}\
  .guide-pinning-enabled #content{margin-left:12px;}\
  .site-center-aligned #masthead-positioner-height-offset{height:50px;}\
  #VLWL-guide-item{display:none;}\
  .yt-lockup-tile .yt-lockup-title{max-width:800px;}\
  #masthead-appbar-container{display:none;}\
  .guide-pinning-enabled .branded-page-v2-secondary-col{max-width:250px;width:250px;}\
  .show-guide.content-snap-width-3 #content{width:95%;}\
  body.watch-fill #player-api{position:fixed!important;top:0px!important;left:0px!important;\
    right:0px!important;bottom:0px!important;width:100%!important;height:100%!important;z-index:10000;}\
  body.watch-fill{overflow:hidden;}\
  body.watch-fill #masthead-positioner{display:none;}\
  body.watch-fill .html5-progress-bar{width:100%!important;}\
  body.watch-fill .html5-main-video{position:absolute;top:0px;right:0px;left:0px;bottom:0px;width:100%!important;height:100%!important;}\
  body.watch-fill .html5-video-content{position:absolute;top:0px;right:0px;left:0px;bottom:0px;width:100%!important;height:100%!important;}\
  .ytp-button-watch-fill{float:right!important;width:30px;height:27px;background:center 6px no-repeat;}\
  body.watch-fill #guide,body.watch-fill #header,body.watch-fill #content{display:none;}\
  #guide-subs-footer-container{padding:0px;}\
  #guide-subscriptions-container .guide-item{width:100%;}\
  #guide-subscriptions-container .guide-item .display-name{width:100%;}\
  #progress-bar{transition:height 0.3s;width:100%;height:4px;position:absolute;border-top:10px solid transparent;bottom:36px}\
  #pb-base-status{background:#252525;position:absolute;left:0px;top:0px;bottom:0px;width:100%}\
  #progress-bar.extended,#progress-bar:hover{height:10px;}\
  #pb-play-status{background:#b31217;position:absolute;left:0px;top:0px;bottom:0px;}\
  #pb-load-status{background:#444;position:absolute;left:0px;top:0px;bottom:0px;}\
  body.watch-fill .html5-video-container{position:absolute;top:0px;right:0px;left:0px;bottom:0px!important;width:100%!important;height:auto!important;}\
  body.watch-fill .html5-video-player{position:fixed;top:0px !important;right:0px !important;left:0px !important;bottom:0px !important}\
  .ytp-chrome-bottom{width:auto !important;right:12px}\
</style>');
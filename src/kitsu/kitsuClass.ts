import * as helper from "./../provider/Kitsu/helper";
import {pageSearch} from './../pages/pages';
import {entryClass} from "./../provider/Kitsu/entryClass";
import {userList} from "./../provider/Kitsu/userList";

interface detail{
  page: "detail",
  id: number,
  malid: number,
  type: "anime"|"manga",
  malObj: undefined
}

interface bookmarks{
  page: "bookmarks",
  type: "anime"|"manga"
}

export class kitsuClass{
  page: any = null

  constructor(public url:string){
    utils.urlChangeDetect(() => {
      this.url = window.location.href;
      this.init();
    });

    if(this.url.indexOf("?mal-sync=authentication") > -1){
      this.init();
    }

    api.storage.addStyle(require('./style.less').toString());
  }

  async init(){
    if(this.url.indexOf("?mal-sync=authentication") > -1){
      this.authentication();
    }

    var urlpart = utils.urlPart(this.url, 3);
    if(urlpart == 'anime' || urlpart == 'manga'){
      var malObj = new entryClass(this.url);
      await malObj.init();

      this.page = {
        page: "detail",
        id: malObj.kitsuId,
        malid: malObj.id,
        type: urlpart,
        malObj: malObj,
      }
      con.log('page', this.page);
      this.streamingUI();
      this.siteSearch()
      this.malToKiss();



    }

    var urlpart4 = utils.urlPart(this.url, 5);
    if(urlpart4 == 'library'){
      var type = 'anime';
      if(utils.urlParam(this.url, 'media') == 'manga') type = 'manga';
      this.page = {
        page: "bookmarks",
        type: type
      }
      con.log('page', this.page);
      this.bookmarks();
    }

  }

  authentication(){
    $(document).ready(function(){
      $('body').after(`
        <div id="mal-sync-login" style="text-align: center; margin-top: 50px; background-color: white; border: 1px solid lightgrey; padding: 10px; max-width: 600px; margin-left: auto; margin-right: auto;">
          <h1>MAL-Sync</h1>
          <br>
          <p style="text-align: left;">
            To login with Kitsu, you need to enter your account's e-mail and password.</br>
            Your credentials are not stored on your computer or anywhere else. </br>
            They are directly sent to kitsu. Only the returned access token is saved.</br>
          </p>
          <div class="modal-content">
            <input type="email" id="email" placeholder="Email" required>
            <input type="password" id="pass" name="password" placeholder="Password" required>
          </div>
          <div class="form-cta" style="margin-top: 30px;">
            <button class="btn button--primary" type="submit" id="mal-sync-button">
                Login
            </button>
          </div>
        </div>
      `);
      $('#mal-sync-login #mal-sync-button').click(function(){
        $('#mal-sync-login #mal-sync-button').attr("disabled","disabled");
        $.ajax({
          type: "POST",
          url: 'https://kitsu.io/api/oauth/token',
          data: 'grant_type=password&username='+$('#mal-sync-login #email').val()+'&password='+$('#mal-sync-login #pass').val(),
          success: function(result){
            var token = result.access_token;
            con.info('token', token);
            api.settings.set('kitsuToken', token).then(() => {
              $('#mal-sync-login').html('<h1>MAL-Sync</h1><br>Token saved you can close this page now')
            });
          },
          error: function(result){
            try{
              con.error(result);
              $('#mal-sync-login #mal-sync-button').prop("disabled", false);
              if(result.responseJSON.error == 'invalid_grant'){
                utils.flashm('Credentials wrong');
                return;
              }
              utils.flashm(result.responseJSON.error_description);
            }catch(e){
              con.error(e);
              utils.flashm(result.responseText);
            }
          }
        });
      })
    });
  }

  async getMalUrl(){
    if(this.page !== null && this.page.page == 'detail' && this.page.malid){
      return 'https://myanimelist.net/'+this.page.type+'/'+this.page.malid+'/'+utils.urlPart(this.url, 5);
    }
    return '';
  }

  async streamingUI(){
    con.log('Streaming UI');
    $('#mal-sync-stream-div').remove();
    var malObj = this.page.malObj;

    var streamUrl = malObj.getStreamingUrl();
    if(typeof streamUrl !== 'undefined'){

      $(document).ready(async function(){
        $('.media--title h3').first().after(`
        <div class="data title progress" id="mal-sync-stream-div" style="display: inline-block; position: relative; top: -4px; display: inline;">
          <a class="mal-sync-stream" title="${streamUrl.split('/')[2]}" target="_blank" style="margin: 0 0;" href="${streamUrl}">
            <img src="${utils.favicon(streamUrl.split('/')[2])}">
          </a>
        </div>`);

        var resumeUrlObj = await malObj.getResumeWaching();
        var continueUrlObj = await malObj.getContinueWaching();
        con.log('Resume', resumeUrlObj, 'Continue', continueUrlObj);
        if(typeof continueUrlObj !== 'undefined' && continueUrlObj.ep === (malObj.getEpisode()+1)){
          $('#mal-sync-stream-div').append(
            `<a class="nextStream" title="Continue watching" target="_blank" style="margin: 0 5px 0 0; color: #BABABA;" href="${continueUrlObj.url}">
              <img src="${api.storage.assetUrl('double-arrow-16px.png')}" width="16" height="16">
            </a>`
            );
        }else if(typeof resumeUrlObj !== 'undefined' && resumeUrlObj.ep === malObj.getEpisode()){
          $('#mal-sync-stream-div').append(
            `<a class="resumeStream" title="Resume watching" target="_blank" style="margin: 0 5px 0 0; color: #BABABA;" href="${resumeUrlObj.url}">
              <img src="${api.storage.assetUrl('arrow-16px.png')}" width="16" height="16">
            </a>`
            );
        }

      });
    }
  }

  malToKiss(){
    con.log('malToKiss');
    $('.mal_links').remove();
    utils.getMalToKissArray(this.page!.type, this.page!.malid).then((links) => {
      var html = '';
      for(var pageKey in links){
        var page = links[pageKey];

        var tempHtml = '';
        var tempUrl = '';
        for(var streamKey in page){
          var stream = page[streamKey];
          tempHtml += `
          <div class="mal_links" style="margin-top: 5px;">
            <a target="_blank" href="${stream['url']}">
              ${stream['title']}
            </a>
          </div>`;
          tempUrl = stream['url'];
        }
        html += `
          <div id="${pageKey}Links" class="mal_links library-state with-header" style="
            background: rgb(var(--color-foreground));
            border-radius: 3px;
            display: block;
            padding: 8px 12px;
            width: 100%;
            font-size: 12px;

          ">
            <img src="${utils.favicon(tempUrl.split('/')[2])}">
            <span style="font-weight: 500; line-height: 16px; vertical-align: middle;">${pageKey}</span>
            <span title="${pageKey}" class="remove-mal-sync" style="float: right; cursor: pointer;">x</span>
            ${tempHtml}
          </div>`;

      }
      $(document).ready(function(){
        if($('#mal-sync-search-links').length){
          $('#mal-sync-search-links').first().after(html);
        }else{
          $('.where-to-watch-widget, .library-state').first().after(html);
        }

        $('.remove-mal-sync').click(function(){
          var key = $(this).attr('title');
          api.settings.set(key, false);
          location.reload();
        });
      });
    })
  }

  siteSearch(){
    if(!api.settings.get('SiteSearch')) return;
    var This = this;
    $(document).ready(function(){
      con.log('Site Search');
      $('#mal-sync-search-links').remove();
      $('.where-to-watch-widget, .library-state').first().after(`
        <div id="mal-sync-search-links" style="
            background: rgb(var(--color-foreground));
            border-radius: 3px;
            display: block;
            padding: 8px 12px;
            width: 100%;
            font-size: 12px;
        " class="library-state with-header">
          <span style="font-weight: 500; line-height: 16px; vertical-align: middle;">Search</span>
          <div class="MALSync-search"><a>[Show]</a></div>
        </div>
      `);
      api.storage.addStyle('#AniList.mal_links img{background-color: #898989;}');
      $('.MALSync-search').one('click', () => {
        var title = $('meta[property="og:title"]').attr('content')
        var titleEncoded = encodeURI(title!);
        var html = '';
        var imgStyle = 'position: relative; top: 0px;'

        for (var key in pageSearch) {
          var page = pageSearch[key];
          if(page.type !== This.page!.type) continue;

          var linkContent = `<img style="${imgStyle}" src="${utils.favicon(page.domain)}"> ${page.name}`;
          if( typeof page.completeSearchTag === 'undefined'){
            var link =
            `<a target="_blank" href="${page.searchUrl(titleEncoded)}">
              ${linkContent}
            </a>`
          }else{
            var link = page.completeSearchTag(title, linkContent);
          }

          var googleSeach = '';
          if( typeof page.googleSearchDomain !== 'undefined'){
            googleSeach =`<a target="_blank" href="https://www.google.com/search?q=${titleEncoded}+site:${page.googleSearchDomain}">
              <img style="${imgStyle}" src="${utils.favicon('google.com')}">
            </a>`;
          }

          html +=
          `<div class="mal_links" id="${key}" style="padding: 1px 0;">
              ${link}
              ${googleSeach}
          </div>`;
        }

        $('.MALSync-search').html(html);
      });
    });
  }

  private tempAnimelist = null;
  private tempMangalist = null;

  bookmarks(){
    var This = this;
    $(document).ready(() => {

      if(this.page!.type == 'anime'){
        if(this.tempAnimelist != null){
          fullListCallback(this.tempAnimelist);
          return;
        }
      }else{
        if(this.tempMangalist != null){
          fullListCallback(this.tempMangalist);
          return;
        }
      }

      userList(1, this.page!.type, {fullListCallback: (list) => {
        if(this.page!.type == 'anime'){
          this.tempAnimelist = list;
        }else{
          this.tempMangalist = list;
        }
        fullListCallback(list);
      }});

      function fullListCallback(list){
        con.log(list);
        $.each(list, async (index, en) => {
          con.log('en', en);
          if(typeof en.id !== 'undefined' && en.id !== null && en.id){
            var element = $('.library-grid-popover:not(.malSyncDone2) a[href^="/'+This.page!.type+'/'+en.kitsuSlug+'"]').first().parent().parent().parent();
            con.log(element);
            element.parent().addClass('malSyncDone2');

            var streamUrl = utils.getUrlFromTags(en.tags);
            if(typeof streamUrl !== 'undefined'){
              con.log(streamUrl);
              element.prepend(`
                <a class="mal-sync-stream mal-rem" title="${streamUrl.split('/')[2]}" target="_blank" style="margin: 0 0; max-height: 14px; z-index: 22; position:absolute; left: 10px; top: 5px;" href="${streamUrl}">
                  <img src="${utils.favicon(streamUrl.split('/')[2])}">
                </a>`);

            }

            var resumeUrlObj = await utils.getResumeWaching(This.page!.type, en.id);
            var continueUrlObj = await utils.getContinueWaching(This.page!.type, en.id);

            var curEp = en.watchedEp;

            con.log('Resume', resumeUrlObj, 'Continue', continueUrlObj);
            if(typeof continueUrlObj !== 'undefined' && continueUrlObj.ep === (curEp+1)){
              element.prepend(
                `<a class="nextStream mal-rem" title="Continue watching" target="_blank" style="color: #BABABA; z-index: 22; position:absolute; top: 5px; left: 35px;" href="${continueUrlObj.url}">
                  <img src="${api.storage.assetUrl('double-arrow-16px.png')}" width="16" height="16">
                </a>`
                );
            }else if(typeof resumeUrlObj !== 'undefined' && resumeUrlObj.ep === curEp){
              element.prepend(
                `<a class="resumeStream mal-rem" title="Resume watching" target="_blank" style="color: #BABABA; z-index: 22; position:absolute; top: 5px; left: 35px;" href="${resumeUrlObj.url}">
                  <img src="${api.storage.assetUrl('arrow-16px.png')}" width="16" height="16">
                </a>`
                );
            }

            utils.epPredictionUI(en.id, This.page!.type, (prediction) => {
              if(!prediction) return;
              element.parent().find('.progress').append(prediction.tag);
            });

          }



        })



      }
    });
  }

}

// This script holds the notice banner content to be shown on top of the page.
// When there is a change of the banner, update content of this script and publish to the proper folder on production server.

const notice = `
<style>
  #notice {
    /*Just apply "display: none" when no notice banner needs to show.*/
    /*display: none;*/
    background-color: #dc3545;
    padding-top: 0.5em;
    padding-bottom: 0.5em;
    margin-top: 0;
    margin-bottom: 0;
    font-size: 14px;
    font-family: Arial, serif;
    color: #ffffff;
    line-height: initial;
    text-align: center;
}
</style>
<div id="notice">
  This server will be down for 8 hours starting Friday, June 3rd, 2022 – 5:00 PM.
</div>
`;
document.getElementById('noticeBanner').innerHTML = notice;

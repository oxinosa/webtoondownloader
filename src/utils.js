const cheerio = require("cheerio");
const request = require("snekfetch");

const get = (url) =>
  request.get(url).then((r) => cheerio.load(r.raw.toString()));

const grabSearchResults = async (searchTerm) => {
  const $ = await get(`https://www.webtoons.com/search?keyword=${searchTerm}`);
  const searchItemCount = $(".card_lst > li > .card_item").length;
  if (searchItemCount > 0) {
    console.log(`Found ${searchItemCount} items.`);
    const searchList = [];
    const list = $(".card_lst > li > .card_item").each(function(i, item) {
      searchList.push({
        name: $(".info > .subj", item).text(),
        id: parseInt($(item).attr("href").split("titleNo=")[1])
      })
    })
    return searchList;
  }
  console.error("Search yielded 0 items");
  return [];
};

module.exports = {
  get,
  grabSearchResults,
};

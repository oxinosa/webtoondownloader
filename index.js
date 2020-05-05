#!/usr/bin/env node

const progress = require("cli-progress");
const path = require("path");
const fs = require("fs");
const cheerio = require("cheerio");
const request = require("snekfetch");
const util = require("util");
const PDFDocument = require("pdfkit");
const main = require("./src/index").main;
const mkdirAsync = util.promisify(fs.mkdir);
const accessAsync = util.promisify(fs.access);
const inquirer = require("inquirer");

let webtoonId = -1;
let episodeToDownloadStart = -1;
let episodeToDownloadEnd = -1;
const episodes = [];
let locationToDownload = path.resolve(process.cwd(), ".");

const get = (url) =>
  request.get(url).then((r) => cheerio.load(r.raw.toString()));

const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

const webToonIdQuestion = () => {
  return new Promise((resolve) => {
    readline.question("Whats the ID of the webtoon you want? ", (id) => {
      webtoonId = id;
      resolve();
    });
  });
};

const grabWebtoonsInfo = async () => {
  const $ = await get(
    `http://www.webtoons.com/en/drama/NAME/list?title_no=${webtoonId}`
  );
  const info = {
    genre: $(".info .genre").text(),
    name: $(".info .subj").text(),
    author: $(".info .author").text().split("author info")[0],
  };
  const episodeCount = +$("li[data-episode-no]")[0].attribs["data-episode-no"];
  info.episodes = episodeCount;
  info.name = info.name.slice(0, info.name.length / 2);
  return info;
};

const grabAnwsers = () => {
  return inquirer
    .prompt([
      {
        type: "number",
        name: "rangeStart",
        message: "What episode you want the download to start? ",
      },
      {
        type: "number",
        name: "rangeEnd",
        message: "What episode you want the download to end? ",
      },
      {
        type: "input",
        name: "location",
        message: "Where do you want the files to download?(provide full path) "
      }
    ])
    .then((anwser) => {
      episodeToDownloadStart = anwser.rangeStart;
      episodeToDownloadEnd = anwser.rangeEnd;
      locationToDownload = anwser.location;
    })
    .catch((e) => {
      console.log(e);
    });
};

const startDownload = async () => {
  const ebar = new progress.Bar({
    format:
      "Indexing Episodes [{bar}] {percentage}% | ETA: {eta}s | Episode {value}/{total}",
  });
  ebar.start(episodeToDownloadEnd - episodeToDownloadStart + 1, 0);
  let eFinished = 1;

  for (
    let i = parseInt(episodeToDownloadStart);
    i <= parseInt(episodeToDownloadEnd);
    i++
  ) {
    const episode = {
      id: i,
      name: undefined,
      links: [],
    };
    const $$ = await get(
      `http://www.webtoons.com/en/drama/N/E/viewer?title_no=${webtoonId}&episode_no=${i}`
    );
    const realname = $$(".subj_episode").text();
    episode.name = realname;
    const images = $$("#_imageList > img");
    episode.links.push(
      ...Array.from(images).map((img, id) => ({
        link: img.attribs["data-url"].split("?")[0],
        id: id,
        width: img.attribs["width"],
        height: img.attribs["height"],
      }))
    );
    ebar.update(eFinished++);
    episodes.push(episode);
  }
  ebar.stop();
};

const startDownloadLinks = async (info) => {
  const ebar = new progress.Bar({
    format:
      "Downloading Episodes [{bar}] {percentage}% | ETA: {eta}s | Episode {value}/{total}",
  });
  ebar.start(episodeToDownloadEnd - episodeToDownloadStart + 1, 0);
  let eFinished = 1;
  for (let i = 0; i < episodes.length; i++) {
    const episode = episodes[i];
    const panels = [];
    await Promise.all(
      episode.links.map(async ({ link, id, width, height }) => {
        const buf = await request
          .get(link)
          .set("Referer", "http://www.webtoons.com")
          .then((r) => r.raw);
        panels.push({ buf, id, width, height });
      })
    );
    panels.sort((p1, p2) => p1.id - p2.id);

    const location = locationToDownload; //path.resolve(process.cwd(), argv.out || ".");
    try {
      await accessAsync(location);
    } catch (err) {
      await mkdirAsync(location);
    }
    const doc = new PDFDocument({ autoFirstPage: false });
    const out = path.resolve(location, `${info.name}-${episode.id}.pdf`);
    doc.pipe(fs.createWriteStream(out));
    for (const { buf, width, height } of panels) {
      doc.addPage({ size: [parseInt(width), parseInt(height)] });
      doc.image(buf, 0, 0);
    }
    doc.end();
    ebar.update(eFinished++);
  }
  ebar.stop();
};

(async () => {
  const id = await main();
  if (typeof id === "undefined") {
    await webToonIdQuestion();
  } else {
    webtoonId = id;
  }
  const info = await grabWebtoonsInfo();
  console.log(`We found ${info.episodes} episodes of ${info.name}`);
  await grabAnwsers();
  await startDownload();
  await startDownloadLinks(info);
  console.log("Enjoy");
})();

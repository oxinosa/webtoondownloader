const inquirer = require("inquirer");
const grabSearchResults = require("./utils").grabSearchResults;

const questions = [
  {
    type: "input",
    name: "searchTerm",
    message: "what do you want to read?",
  },
];

const askQuestions = async () => {
  return inquirer
    .prompt(questions)
    .then((answers) => {
      return answers;
    })
    .catch((e) => {
      if (e.isTtyError) {
        // Propmt couldn't be rendered
      } else {
        // Something went wrong
      }
    });
};

const askWhatToDownload = async (list) => {
  return inquirer
    .prompt([
      {
        type: "list",
        name: "webtoonId",
        message: "Choose one",
        choices: [...list.map((x) => x.name)],
      },
    ])
    .then((a) => {
      const { webtoonId } = a;
      const id = list.filter(f => f.name === webtoonId)[0].id;
      return id;
    });
};

const main = async () => {
  const answers = await askQuestions();
  const list = await grabSearchResults(answers.searchTerm);
  const id = await askWhatToDownload(list);
  console.log(id);
};

main();

// npm packages
const fs = require('fs');
const path = require('path');

const nodeDockerfile = ({hasYarn}) =>
  `FROM yobasystems/alpine-nodejs:armhf-current

# create folder and set it as workdir
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

#update dependencies
RUN apk update
RUN apk upgrade

#add dependencies
RUN apk add -U curl git make gcc g++ python linux-headers paxctl libgcc libstdc++ binutils-gold ca-certificates

#update npm
RUN npm install npm -g

#add yarn
RUN npm install yarn -g

# copy package and yarn files to cache deps install
COPY package.json /usr/src/app/${
    hasYarn
      ? `
COPY yarn.lock /usr/src/app/
RUN yarn install --production`
      : `
RUN npm install --only=prod`
  }

# copy app itself
COPY . /usr/src/app

EXPOSE 80
EXPOSE 443

CMD ["npm", "start"]
`;

// template name
exports.name = 'exoframe-template-arm32v7-nodejs';

// function to check if the template fits this recipe
exports.checkTemplate = async ({tempDockerDir}) => {
  // if project already has dockerfile - just exit
  try {
    const filesList = fs.readdirSync(tempDockerDir);
    if (filesList.includes('package.json')) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
};

// function to execute current template
exports.executeTemplate = async ({username, tempDockerDir, resultStream, util, docker, existing}) => {
  try {
    // generate dockerfile
    const filesList = fs.readdirSync(tempDockerDir);
    const dockerfile = nodeDockerfile({hasYarn: filesList.includes('yarn.lock')});
    const dfPath = path.join(tempDockerDir, 'Dockerfile');
    fs.writeFileSync(dfPath, dockerfile, 'utf-8');
    util.writeStatus(resultStream, {message: 'Deploying Node.js project..', level: 'info'});

    // build docker image
    const buildRes = await docker.build({username, resultStream});
    util.logger.debug('Build result:', buildRes);

    // start image
    const container = await docker.start(Object.assign({}, buildRes, {username, existing, resultStream}));
    util.logger.debug(container.Name);

    // clean temp folder
    await util.cleanTemp();

    // return new deployments
    util.writeStatus(resultStream, {message: 'Deployment success!', deployments: [container], level: 'info'});
    resultStream.end('');
  } catch (e) {
    util.logger.debug('build failed!', e);
    util.writeStatus(resultStream, {message: e.error, error: e.error, log: e.log, level: 'error'});
    resultStream.end('');
  }
};
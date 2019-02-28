// npm packages
const fs = require('fs');
const path = require('path');

const nodeDockerfile = () =>
`FROM yobasystems/alpine-nodejs:arm32v7-min

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

# copy package.json and install
COPY package.json /usr/src/app/
RUN npm install --silent --only=prod

#add dependencies
RUN apk del -U curl python

# copy app itself
COPY . /usr/src/app

EXPOSE 80
EXPOSE 443

CMD ["npm", "start"]
`;

// template name
exports.name = 'exoframe-template-arm32v7-nodejs';

// function to check if the template fits this recipe
exports.checkTemplate = async ({tempDockerDir, folder}) => {
  // if project already has dockerfile - just exit
  try {
    const filesList = fs.readdirSync(path.join(tempDockerDir, folder));
    if (filesList.includes('package.json')) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
};

// function to execute current template
exports.executeTemplate = async ({username, tempDockerDir, folder, resultStream, util, docker, existing}) => {
  try {
    // generate dockerfile
    const dockerfile = nodeDockerfile();
    const dfPath = path.join(tempDockerDir, folder, 'Dockerfile');
    fs.writeFileSync(dfPath, dockerfile, 'utf-8');
    util.writeStatus(resultStream, {message: 'Deploying Node.js project on armhf..', level: 'info'});

    // build docker image
    const buildRes = await docker.build({username, folder, resultStream});
    util.logger.debug('Build result:', buildRes);

    // start image
    const container = await docker.start(Object.assign({}, buildRes, {username, folder, existing, resultStream}));
    util.logger.debug(container.Name);

    // return new deployments
    util.writeStatus(resultStream, {message: 'Deployment success!', deployments: [container], level: 'info'});
    resultStream.end('');
  } catch (e) {
    util.logger.debug('build failed!', e);
    util.writeStatus(resultStream, {message: e.error, error: e.error, log: e.log, level: 'error'});
    resultStream.end('');
  }
};
const logger = require('./logger');
const fetch = require('node-fetch');
const ProxyAgent = require('proxy-agent');
const querystring = require('querystring');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

class Gitlab {
  constructor(configs) {
    this.action = configs.action;
    this.gid = configs.gid;
    this.projects = configs.projects;
    this.parameters = configs.parameters;

    this.fetch = async ({ method = 'get', url }) => {
      try {
        const ignoreSsl = configs.ignoreSsl;
        const option = {
          method,
          agent: new ProxyAgent(),
          headers: {
            'PRIVATE-TOKEN': configs.token,
          },
        };

        return await fetch(`${configs.api}${url}`, option);
      } catch (error) {
        logger.error('Network error');
        process.exit(0);
      }
    };
  }

  getProjectId = async (p) => {
    const searchApi = this.gid
      ?`/groups/${this.gid}/search?scope=projects&confidential=true&search=${p}`
      :`/search?scope=projects&confidential=true&search=${p}`

    const res = await this.fetch({
      url: searchApi,
    });

    const projectInfo = await res.json();
    return projectInfo.find((el) => el.name === p).id;
  };

  projectApi = async (api, method = 'get') => {
    const runAsync = async (p) => {
      const pid = await this.getProjectId(p);
      const res = await this.fetch({
        method,
        url: `/projects/${pid}${api}`,
      });

      if(res.status > 299){
        const body = await res.text();
        logger.red(`[${res.status}] ${p}, ${api} ${body}`);
      } else {
        logger.log(`[${res.status}] ${p}`);
      }
      return res;
    };

    for(let p of this.projects){
      await sleep(1000)
      runAsync(p)
    }
  };

  'create tag' = async () => {
    const { tag, ref } = this.parameters;
    logger.info(`Create tag ${tag} from ${ref}`);
    this.projectApi(`/repository/tags?tag_name=${tag}&ref=${ref}`, 'post');
  };

  'delete tag' = () => {
    const { tag } = this.parameters;
    logger.info(`Delete tag ${tag}`);
    this.projectApi(`/repository/tags/${tag}`, 'delete');
  };

  'create branch' = async () => {
    const { branch, ref } = this.parameters;
    logger.info(`Create branches ${branch} from ${ref}`);
    this.projectApi(`/repository/branches?branch=${branch}&ref=${ref}`, 'post');
  };

  'delete branch' = () => {
    const { branch } = this.parameters;
    logger.info(`Delete tag ${branch}`);
    this.projectApi(`/repository/branches/${branch}`, 'delete');
  };

  protect = () => {
    const { ref } = this.parameters;
    logger.info(`Protect ${ref}`);
    this.projectApi(`/protected_branches?name=${ref}`, 'post');
  };

  unprotect = () => {
    const { ref } = this.parameters;
    logger.info(`Unprotect ${ref}`);
    this.projectApi(`/protected_branches/${ref}`, 'delete');
  };

  merge = () => {};

  exec = () => {
    this[this.action]();
  };
}

module.exports = Gitlab;

// this is the name of the pid that otherwise unlinked pids will group around, to keep all of a node's pids together
const GROUPING_PID = "application_controller";

export default class {
  constructor(pid, info) {
    this.id = pid;
    this.links = {};
    this.name = info.name;
    this.node = info.node;
    this.application = info.application;
    this.type = info.type;
    this.msg_traced = info.msg_traced;

    if (this.isGroupingProcess()) {
      this.invisible_links = {};
    }
  }

  isGroupingProcess() {
    return this.name == GROUPING_PID;
  }

  qualifiedName() {
    return this.name + "@" + this.node.replace(/@.*/, '');
  }
}

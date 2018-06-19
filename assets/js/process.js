// this is the name of the pid that otherwise unlinked pids will group around, to keep all of a node's pids together
const GROUPING_PID = "net_kernel";

export default class {
  constructor(pid, info) {
    this.id = pid;
    this.links = {};
    this.name = info.name;
    this.node = info.node;
    this.application = info.application;
    this.type = info.type;
    this.msg_traced = info.msg_traced;

    if (this.isGroupingPid()) {
      this.invisible_links = {};
    }
  }

  isGroupingPid() {
    return this.name == GROUPING_PID;
  }
}

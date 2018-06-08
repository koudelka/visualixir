import "phoenix_html";
import {Socket} from "phoenix";

import NodeSelector from "./node_selector.js";
import ClusterView from "./cluster_view.js";


class App {
  constructor(node_selector_container) {
    this.node_selector = new NodeSelector(node_selector_container, this.channel);
    this.cluster_view = new ClusterView($('#graph'), $('#msg_seq'), $('#log'));
    $('#stop_msg_tracing').click(e => {
      if (this.cluster_view)
        this.cluster_view.stopMsgTraceAll();
    });
  }
}

$( () => {
  window.socket = new Socket("/socket");
  window.socket.connect();

  window.app = new App($('#node_selector'));
})

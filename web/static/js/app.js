import "deps/phoenix_html/web/static/js/phoenix_html";

import {Socket} from "deps/phoenix/web/static/js/phoenix";

import NodeSelector from "./node_selector";
import NodeView from "./node_view";


class App {
  constructor(node_selector_container) {
    this.node_selector = new NodeSelector(node_selector_container, this.channel);
    $('#stop_msg_tracing').click(e => {
      if (this.node_view)
        this.node_view.stopMsgTraceAll();
    });
  }

  // this should go away when the frontend supports watching multiple nodes
  switchToNode(node) {
    if(this.node_view) {
      this.node_view.cleanup();
      this.node_selector.cleanup(this.node_view.node);
    }
    this.node_view = new NodeView(node, $('#graph'), $('#log'));
  }

}

$( () => {
  window.socket = new Socket("/socket");
  socket.connect();

  window.app = new App($('#node_selector'));
})

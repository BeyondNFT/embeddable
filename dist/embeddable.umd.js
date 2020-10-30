
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Embeddable = factory());
}(this, (function () { 'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.29.4' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /**
     * Returns a Promise that resolves to the value of window.ethereum if it is
     * set within the given timeout, or null.
     * The Promise will not reject, but an error will be thrown if invalid options
     * are provided.
     *
     * @param {Object} [options] - Options bag.
     * @param {boolean} [options.mustBeMetaMask] - Whether to only look for MetaMask
     * providers. Default: false
     * @param {boolean} [options.silent] - Whether to silence console errors. Does
     * not affect thrown errors. Default: false
     * @param {number} [options.timeout] - Milliseconds to wait for
     * 'ethereum#initialized' to be dispatched. Default: 3000
     * @returns {Promise<EthereumProvider | null>} A Promise that resolves with the
     * Provider if it is detected within the given timeout, otherwise null.
     */
    var detectProvider = function detectEthereumProvider ({
      mustBeMetaMask = false,
      silent = false,
      timeout = 3000,
    } = {}) {

      _validateInputs();

      let handled = false;

      return new Promise((resolve) => {
        if (window.ethereum) {

          handleEthereum();

        } else {

          window.addEventListener(
            'ethereum#initialized',
            handleEthereum,
            { once: true },
          );

          setTimeout(() => {
            handleEthereum();
          }, timeout);
        }

        function handleEthereum () {

          if (handled) {
            return
          }
          handled = true;

          window.removeEventListener('ethereum#initialized', handleEthereum);

          const { ethereum } = window;

          if (ethereum && (!mustBeMetaMask || ethereum.isMetaMask)) {
            resolve(ethereum);
          } else {

            const message = mustBeMetaMask && ethereum
              ? 'Non-MetaMask window.ethereum detected.'
              : 'Unable to detect window.ethereum.';

            !silent && console.error('@metamask/detect-provider:', message);
            resolve(null);
          }
        }
      })

      function _validateInputs () {
        if (typeof mustBeMetaMask !== 'boolean') {
          throw new Error(`@metamask/detect-provider: Expected option 'mustBeMetaMask' to be a boolean.`)
        }
        if (typeof silent !== 'boolean') {
          throw new Error(`@metamask/detect-provider: Expected option 'silent' to be a boolean.`)
        }
        if (typeof timeout !== 'number') {
          throw new Error(`@metamask/detect-provider: Expected option 'timeout' to be a number.`)
        }
      }
    };

    var abi = [
      {
        inputs: [
          {
            internalType: 'uint256',
            name: 'tokenId',
            type: 'uint256',
          },
        ],
        name: 'tokenURI',
        outputs: [
          {
            internalType: 'string',
            name: '',
            type: 'string',
          },
        ],
        stateMutability: 'view',
        type: 'function',
        constant: true,
      },
      {
        inputs: [
          {
            internalType: 'uint256',
            name: 'tokenId',
            type: 'uint256',
          },
        ],
        name: 'interactiveConfURI',
        outputs: [
          {
            internalType: 'string',
            name: '',
            type: 'string',
          },
        ],
        stateMutability: 'view',
        type: 'function',
        constant: true,
      },
    ];

    async function getProvider() {
      if (!Web3 || Web3.version !== '1.3.0') {
        await loadWeb3();
      }

      const provider = await detectProvider();
      if (provider) {
        const web3 = new Web3(provider);
        return { web3, provider };
      } else {
        throw new Error(`
			No ethereum provider detected.
			Please install Metamask or any other wallet (Polaris, Trust Wallet...).
		`);
      }
    }

    async function loadWeb3() {
      return new Promise((resolve, reject) => {
        const src = 'https://cdnjs.cloudflare.com/ajax/libs/web3/1.3.0/web3.min.js';
        const script = document.createElement('script');
        script.onload = resolve;
        script.onerror = reject;
        script.src = src;
        document.body.appendChild(script);
      });
    }
    async function getContract(web3, address) {
      return new web3.eth.Contract(abi, address);
    }

    class Proxy {
      constructor(address, tokenId, chaindId) {
        this.address = address;
        this.tokenId = tokenId;
        this.chaindId = chaindId;

        this.web3;
        this.provider;
      }

      async connect() {
        const detected = await getProvider();
        this.web3 = detected.web3;
        this.provider = detected.provider;

        // check that the chainId is the right one
        let chaindId = await this.web3.eth.net.getId();
        if (chaindId !== this.chaindId) {
          throw new Error(
            `Connected to the wrong network. Current{${chaindId}}; Expected{${this.chaindId}}`
          );
        }

        this.instance = await getContract(this.web3, this.address);
      }

      // TODO: Manage call to ERC1155
      async uris() {
        try {
          const tokenURI = await this.tokenURI();
          let interactiveConfURI = '';

          try {
            interactiveConfURI = await this.interactiveConfURI();
          } catch (e) {}

          return { tokenURI, interactiveConfURI };
        } catch (e) {
          console.log(e);
        }
      }

      async tokenURI() {
        return this.instance.methods.tokenURI(this.tokenId).call();
      }

      async interactiveConfURI() {
        return this.instance.methods.interactiveConfURI(this.tokenId).call();
      }
    }

    var Networks = {
      mainnet: 0x1,
      ropsten: 0x3,
      rinkeby: 0x4,
      goerli: 0x5,
      kovan: 0x2a,
    };

    function n(){}function e(n){return n()}function t(){return Object.create(null)}function o(n){n.forEach(e);}function r(n){return "function"==typeof n}function s(n,e){return n!=n?e==e:n!==e||n&&"object"==typeof n||"function"==typeof n}function a(n,e){n.appendChild(e);}function i(n,e,t){n.insertBefore(e,t||null);}function c(n){n.parentNode.removeChild(n);}function l(n){return document.createElement(n)}function d(n){return document.createTextNode(n)}function u(n,e,t){null==t?n.removeAttribute(e):n.getAttribute(e)!==t&&n.setAttribute(e,t);}function p(n,e,t){n.classList[t?"add":"remove"](e);}let f;function g(n){f=n;}function _(){if(!f)throw new Error("Function called outside component initialization");return f}function h(n){_().$$.on_mount.push(n);}function m(){const n=_();return (e,t)=>{const o=n.$$.callbacks[e];if(o){const r=function(n,e){const t=document.createEvent("CustomEvent");return t.initCustomEvent(n,!1,!1,e),t}(e,t);o.slice().forEach((e=>{e.call(n,r);}));}}}function v(n,e){const t=n.$$.callbacks[e.type];t&&t.slice().forEach((n=>n(e)));}const w=[],y=[],b=[],$=[],x=Promise.resolve();let k=!1;function E(n){b.push(n);}let N=!1;const j=new Set;function M(){if(!N){N=!0;do{for(let n=0;n<w.length;n+=1){const e=w[n];g(e),O(e.$$);}for(g(null),w.length=0;y.length;)y.pop()();for(let n=0;n<b.length;n+=1){const e=b[n];j.has(e)||(j.add(e),e());}b.length=0;}while(w.length);for(;$.length;)$.pop()();k=!1,N=!1,j.clear();}}function O(n){if(null!==n.fragment){n.update(),o(n.before_update);const e=n.dirty;n.dirty=[-1],n.fragment&&n.fragment.p(n.ctx,e),n.after_update.forEach(E);}}const A=new Set;let S;function C(n,e){n&&n.i&&(A.delete(n),n.i(e));}function L(n,e,t,o){if(n&&n.o){if(A.has(n))return;A.add(n),S.c.push((()=>{A.delete(n),o&&(t&&n.d(1),o());})),n.o(e);}}function T(n,t,s){const{fragment:a,on_mount:i,on_destroy:c,after_update:l}=n.$$;a&&a.m(t,s),E((()=>{const t=i.map(e).filter(r);c?c.push(...t):o(t),n.$$.on_mount=[];})),l.forEach(E);}function F(n,e){const t=n.$$;null!==t.fragment&&(o(t.on_destroy),t.fragment&&t.fragment.d(e),t.on_destroy=t.fragment=null,t.ctx=[]);}function J(n,e){-1===n.$$.dirty[0]&&(w.push(n),k||(k=!0,x.then(M)),n.$$.dirty.fill(0)),n.$$.dirty[e/31|0]|=1<<e%31;}function P(e,r,s,a,i,l,d=[-1]){const u=f;g(e);const p=r.props||{},_=e.$$={fragment:null,ctx:null,props:l,update:n,not_equal:i,bound:t(),on_mount:[],on_destroy:[],before_update:[],after_update:[],context:new Map(u?u.$$.context:[]),callbacks:t(),dirty:d,skip_bound:!1};let h=!1;if(_.ctx=s?s(e,p,((n,t,...o)=>{const r=o.length?o[0]:t;return _.ctx&&i(_.ctx[n],_.ctx[n]=r)&&(!_.skip_bound&&_.bound[n]&&_.bound[n](r),h&&J(e,n)),t})):[],_.update(),h=!0,o(_.before_update),_.fragment=!!a&&a(_.ctx),r.target){if(r.hydrate){const n=function(n){return Array.from(n.childNodes)}(r.target);_.fragment&&_.fragment.l(n),n.forEach(c);}else _.fragment&&_.fragment.c();r.intro&&C(e.$$.fragment),T(e,r.target,r.anchor),M();}g(u);}class D{$destroy(){F(this,1),this.$destroy=n;}$on(n,e){const t=this.$$.callbacks[n]||(this.$$.callbacks[n]=[]);return t.push(e),()=>{const n=t.indexOf(e);-1!==n&&t.splice(n,1);}}$set(n){var e;this.$$set&&(e=n,0!==Object.keys(e).length)&&(this.$$.skip_bound=!0,this.$$set(n),this.$$.skip_bound=!1);}}let K=1;function R(n){let e=n.action,t=n.cmd_id,o=this.pending_cmds.get(t);if(o){if(this.pending_cmds.delete(t),"cmd_error"===e){let{message:e,stack:t}=n,r=new Error(e);r.stack=t,o.reject(r);}"cmd_ok"===e&&o.resolve(n.args||"ok");}else console.error("command not found",t,n,[...this.pending_cmds.keys()]);}function U(n){if(n.source!==this.iframe.contentWindow)return;const{action:e,args:t}=n.data;switch(e){case"cmd_error":case"cmd_ok":return R.call(this,n.data);case"fetch_progress":return this.handlers.on_fetch_progress(t.remaining);case"error":return this.handlers.on_error(n.data);case"unhandledrejection":return this.handlers.on_unhandled_rejection(n.data);case"console":return this.handlers.on_console(n.data);case"console_group":return this.handlers.on_console_group(n.data);case"console_group_collapsed":return this.handlers.on_console_group_collapsed(n.data);case"console_group_end":return this.handlers.on_console_group_end(n.data);default:const o="on_"+e;"function"==typeof this.handlers[o]&&this.handlers[o](n.data);}}class W{constructor(n,e){this.iframe=n,this.handlers=e,this.pending_cmds=new Map,this.handle_event=U.bind(this),window.addEventListener("message",this.handle_event,!1);}destroy(){window.removeEventListener("message",this.handle_event);}iframe_command(n,e){return new Promise(((t,o)=>{const r=K++;this.pending_cmds.set(r,{resolve:t,reject:o}),this.iframe.contentWindow.postMessage({action:n,cmd_id:r,args:e},"*");}))}eval(n){return this.iframe_command("eval",{script:n})}add_script(n){return this.iframe_command("add_script",n)}add_script_content(n){return this.iframe_command("add_script_content",n)}add_style(n){return this.iframe_command("add_style",n)}add_asset(n){return this.iframe_command("add_asset",n)}handle_links(){return this.iframe_command("catch_clicks",{})}}function Y(n){let e;return {c(){e=l("strong"),e.innerHTML="<em>Sorry, an error occured while executing the NFT.</em>",u(e,"class","beyondnft__sandbox__error svelte-1bwdt9k");},m(n,t){i(n,e,t);},d(n){n&&c(e);}}}function z(e){let t,o,r,s,f,g=e[3]&&Y();return {c(){t=l("div"),o=l("iframe"),f=d(" "),g&&g.c(),u(o,"title","Sandbox"),u(o,"sandbox",r="allow-scripts allow-pointer-lock allow-popups "+e[0]),u(o,"srcdoc",s=e[4]("<!DOCTYPE html>\n<html>\n  <head>\n    <style>\n      \n    </style>\n\n    <script>\n      (function () {\n        const local_eval = eval;\n        eval = function () {};\n\n        function handle_message(ev) {\n          let { action, cmd_id } = ev.data;\n          const send_message = (payload) =>\n            parent.postMessage({ ...payload }, ev.origin);\n\n          const send_reply = (payload) => send_message({ ...payload, cmd_id });\n          const send_ok = (args) => send_reply({ action: 'cmd_ok', args });\n          const send_error = (message, stack) =>\n            send_reply({ action: 'cmd_error', message, stack });\n\n          if (action === 'eval') {\n            try {\n              const { script } = ev.data.args;\n              local_eval(script);\n              send_ok();\n            } catch (e) {\n              send_error(e.message, e.stack);\n            }\n          }\n\n          if (action === 'add_script') {\n            try {\n              const script = document.createElement('script');\n              script.src = ev.data.args;\n              script.onload = () => send_ok();\n              document.body.appendChild(script);\n            } catch (e) {\n              send_error(e.message, e.stack);\n            }\n          }\n\n          if (action === 'add_script_content') {\n            try {\n              const script = document.createElement('script');\n              script.text = ev.data.args;\n              script.type = 'text/javascript';\n              document.body.appendChild(script);\n              send_ok();\n            } catch (e) {\n              send_error(e.message, e.stack);\n            }\n          }\n\n          if (action === 'add_style') {\n            try {\n              const link = document.createElement('link');\n              link.rel = 'stylesheet';\n              link.href = ev.data.args;\n              link.onload = () => send_ok();\n              document.body.appendChild(link);\n            } catch (e) {\n              send_error(e.message, e.stack);\n            }\n          }\n\n          if (action === 'catch_clicks') {\n            try {\n              const top_origin = ev.origin;\n              document.body.addEventListener('click', (event) => {\n                if (event.which !== 1) return;\n                if (event.metaKey || event.ctrlKey || event.shiftKey) return;\n                if (event.defaultPrevented) return;\n\n                // ensure target is a link\n                let el = event.target;\n                while (el && el.nodeName !== 'A') el = el.parentNode;\n                if (!el || el.nodeName !== 'A') return;\n\n                if (\n                  el.hasAttribute('download') ||\n                  el.getAttribute('rel') === 'external' ||\n                  el.target\n                )\n                  return;\n\n                event.preventDefault();\n\n                if (el.href.startsWith(top_origin)) {\n                  const url = new URL(el.href);\n                  if (url.hash[0] === '#') {\n                    window.location.hash = url.hash;\n                    return;\n                  }\n                }\n\n                window.open(el.href, '_blank');\n              });\n              send_ok();\n            } catch (e) {\n              send_error(e.message, e.stack);\n            }\n          }\n        }\n\n        window.addEventListener('message', handle_message, false);\n\n        window.onerror = function (msg, url, lineNo, columnNo, error) {\n          try {\n            parent.postMessage({ action: 'error', value: error }, '*');\n          } catch (e) {\n            parent.postMessage({ action: 'error', value: msg }, '*');\n            parent.postMessage({ action: 'error', value: error }, '*');\n          }\n        };\n\n        window.addEventListener('unhandledrejection', (event) => {\n          parent.postMessage(\n            { action: 'unhandledrejection', value: event.reason },\n            '*'\n          );\n        });\n\n        let previous = { level: null, args: null };\n\n        ['clear', 'log', 'info', 'dir', 'warn', 'error', 'table'].forEach(\n          (level) => {\n            const original = console[level];\n            console[level] = (...args) => {\n              const stringifiedArgs = stringify(args);\n              if (\n                previous.level === level &&\n                previous.args &&\n                previous.args === stringifiedArgs\n              ) {\n                parent.postMessage(\n                  { action: 'console', level, duplicate: true },\n                  '*'\n                );\n              } else {\n                previous = { level, args: stringifiedArgs };\n\n                try {\n                  parent.postMessage({ action: 'console', level, args }, '*');\n                } catch (err) {\n                  parent.postMessage(\n                    { action: 'console', level: 'unclonable' },\n                    '*'\n                  );\n                }\n              }\n\n              original(...args);\n            };\n          }\n        );\n\n        [\n          { method: 'group', action: 'console_group' },\n          { method: 'groupEnd', action: 'console_group_end' },\n          { method: 'groupCollapsed', action: 'console_group_collapsed' },\n        ].forEach((group_action) => {\n          const original = console[group_action.method];\n          console[group_action.method] = (label) => {\n            parent.postMessage({ action: group_action.action, label }, '*');\n\n            original(label);\n          };\n        });\n\n        const timers = new Map();\n        const original_time = console.time;\n        const original_timelog = console.timeLog;\n        const original_timeend = console.timeEnd;\n\n        console.time = (label = 'default') => {\n          original_time(label);\n          timers.set(label, performance.now());\n        };\n        console.timeLog = (label = 'default') => {\n          original_timelog(label);\n          const now = performance.now();\n          if (timers.has(label)) {\n            parent.postMessage(\n              {\n                action: 'console',\n                level: 'system-log',\n                args: [`${label}: ${now - timers.get(label)}ms`],\n              },\n              '*'\n            );\n          } else {\n            parent.postMessage(\n              {\n                action: 'console',\n                level: 'system-warn',\n                args: [`Timer '${label}' does not exist`],\n              },\n              '*'\n            );\n          }\n        };\n        console.timeEnd = (label = 'default') => {\n          original_timeend(label);\n          const now = performance.now();\n          if (timers.has(label)) {\n            parent.postMessage(\n              {\n                action: 'console',\n                level: 'system-log',\n                args: [`${label}: ${now - timers.get(label)}ms`],\n              },\n              '*'\n            );\n          } else {\n            parent.postMessage(\n              {\n                action: 'console',\n                level: 'system-warn',\n                args: [`Timer '${label}' does not exist`],\n              },\n              '*'\n            );\n          }\n          timers.delete(label);\n        };\n\n        const original_assert = console.assert;\n        console.assert = (condition, ...args) => {\n          if (condition) {\n            const stack = new Error().stack;\n            parent.postMessage(\n              { action: 'console', level: 'assert', args, stack },\n              '*'\n            );\n          }\n          original_assert(condition, ...args);\n        };\n\n        const counter = new Map();\n        const original_count = console.count;\n        const original_countreset = console.countReset;\n\n        console.count = (label = 'default') => {\n          counter.set(label, (counter.get(label) || 0) + 1);\n          parent.postMessage(\n            {\n              action: 'console',\n              level: 'system-log',\n              args: `${label}: ${counter.get(label)}`,\n            },\n            '*'\n          );\n          original_count(label);\n        };\n\n        console.countReset = (label = 'default') => {\n          if (counter.has(label)) {\n            counter.set(label, 0);\n          } else {\n            parent.postMessage(\n              {\n                action: 'console',\n                level: 'system-warn',\n                args: `Count for '${label}' does not exist`,\n              },\n              '*'\n            );\n          }\n          original_countreset(label);\n        };\n\n        const original_trace = console.trace;\n\n        console.trace = (...args) => {\n          const stack = new Error().stack;\n          parent.postMessage(\n            { action: 'console', level: 'trace', args, stack },\n            '*'\n          );\n          original_trace(...args);\n        };\n\n        function stringify(args) {\n          try {\n            return JSON.stringify(args);\n          } catch (error) {\n            return null;\n          }\n        }\n      })(this);\n\n      // remove alert, set window context\n      (() => {\n        const original_alert = window.alert;\n        window.alert = function () {};\n\n        window.context = {\n          nft_json: {},\n          config: {},\n          owner: '0x0000000000000000000000000000000000000000',\n        };\n      })(this);\n    <\/script>\n  </head>\n  <body>\n    \x3c!-- NFTCODE --\x3e\n  </body>\n</html>\n")),u(o,"class","svelte-1bwdt9k"),p(o,"greyed-out",e[3]||B||e[2]),u(t,"class","beyondnft__sandbox svelte-1bwdt9k");},m(n,r){i(n,t,r),a(t,o),e[10](o),a(t,f),g&&g.m(t,null);},p(n,[e]){1&e&&r!==(r="allow-scripts allow-pointer-lock allow-popups "+n[0])&&u(o,"sandbox",r),12&e&&p(o,"greyed-out",n[3]||B||n[2]),n[3]?g||(g=Y(),g.c(),g.m(t,null)):g&&(g.d(1),g=null);},i:n,o:n,d(n){n&&c(t),e[10](null),g&&g.d();}}}let B=!1;function q(n,e,t){let{code:o=""}=e,{proxy:r}=e,{json:s}=e,{owner_properties:a}=e,{owner:i}=e,{sandbox_props:c=""}=e;const l=m();let d,u,p,f=0,g=[],_=[],v=g;function w(){return s.interactive_nft?function(n){let e="";if(Array.isArray(n))for(const t of n){const n=t.type;"script"===n?e+=`<script type="text/javascript" src="${t.url}"><\/script>`:"style"===n?e+=`<script type="text/javascript">\n\t\t\t\t\t\t(() => {\n\t\t\t\t\t\t\tconst link = document.createElement('link');\n\t\t\t\t\t\t\tlink.rel = 'stylesheet';\n\t\t\t\t\t\t\tlink.href = "${t.url}";\n\t\t\t\t\t\t\tdocument.body.appendChild(link);\n\t\t\t\t\t\t})()\n\t\t\t\t\t<\/script>`:console.log("Unknown dependency type "+n);}return e}(s.interactive_nft.dependencies):""}function b(n){t(3,u=n),l("error",n);}function $(n){v.push(p=n),g=g;}function x(n,e){const t={level:"group",label:n,collapsed:e,logs:[]};v.push(t),_.push(v),v=t.logs,g=g;}return h((()=>(t(5,r=new W(d,{on_fetch_progress:n=>{t(2,f=n);},on_error:n=>{$({level:"error",args:[n.value]}),b(n.value);},on_unhandled_rejection:n=>{let e=n.value;"string"==typeof e&&(e={message:e}),e.message="Uncaught (in promise): "+e.message,$({level:"error",args:[e]}),b(e);},on_console:n=>{"clear"===n.level?(v=g=[],$(n)):n.duplicate?function(){const n=v[v.length-1];n?(n.count=(n.count||1)+1,g=g):(p.count=1,$(p));}():$(n);},on_console_group:n=>{x(n.label,!1);},on_console_group_end:()=>{v=_.pop();},on_console_group_collapsed:n=>{x(n.label,!0);}})),d.addEventListener("load",(()=>{r.handle_links(),!u&&l("loaded");})),()=>{r.destroy();}))),n.$$set=n=>{"code"in n&&t(6,o=n.code),"proxy"in n&&t(5,r=n.proxy),"json"in n&&t(7,s=n.json),"owner_properties"in n&&t(8,a=n.owner_properties),"owner"in n&&t(9,i=n.owner),"sandbox_props"in n&&t(0,c=n.sandbox_props);},[c,d,f,u,function(n){let e=w();const t=function(){const n={};if(s.interactive_nft&&Array.isArray(s.interactive_nft.properties)){let e={};a&&"object"==typeof a&&(e=a);for(const t of s.interactive_nft.properties)n[t.name]=t.value,void 0!==e[t.name]&&(n[t.name]=e[t.name]);}return n}(),r=`\n      window.context.properties = JSON.parse('${JSON.stringify(t)}');\n    `,c=`\n      window.context.nft_json = JSON.parse(${JSON.stringify(JSON.stringify(s))});\n    `,l=`window.context.owner = ${JSON.stringify(i)};`;return e+=`<script type="text/javascript">${`\n      // specific p5 because it's causing troubles.\n      if (typeof p5 !== 'undefined' && p5.disableFriendlyErrors) {\n        p5.disableFriendlyErrors = true;\n        new p5();\n      }\n\n      ${r}\n      ${c}\n      ${l}\n    `}<\/script>`,e+=o,n.replace("\x3c!-- NFTCODE --\x3e",e)},r,o,s,a,i,function(n){y[n?"unshift":"push"]((()=>{d=n,t(1,d);}));}]}class H extends D{constructor(n){var e;super(),document.getElementById("svelte-1bwdt9k-style")||((e=l("style")).id="svelte-1bwdt9k-style",e.textContent=".beyondnft__sandbox.svelte-1bwdt9k{background-color:white;border:none;width:100%;height:100%;position:relative}iframe.svelte-1bwdt9k{width:100%;height:100%;border:none;display:block}.greyed-out.svelte-1bwdt9k{filter:grayscale(50%) blur(1px);opacity:0.25}.beyondnft__sandbox__error.svelte-1bwdt9k{font-size:0.9em;position:absolute;top:0;left:0;padding:5px}",a(document.head,e)),P(this,n,q,z,s,{code:6,proxy:5,json:7,owner_properties:8,owner:9,sandbox_props:0});}}function I(e){let t;return {c(){t=d("Loading...");},m(n,e){i(n,t,e);},p:n,i:n,o:n,d(n){n&&c(t);}}}function G(n){let e,t,o;function r(e){n[8].call(null,e);}let s={code:n[1],owner_properties:n[2],sandbox_props:n[4],owner:n[3],json:n[0]};return void 0!==n[5]&&(s.proxy=n[5]),e=new H({props:s}),y.push((()=>function(n,e,t){const o=n.$$.props[e];void 0!==o&&(n.$$.bound[o]=t,t(n.$$.ctx[o]));}(e,"proxy",r))),e.$on("loaded",n[9]),e.$on("error",n[10]),e.$on("warning",n[11]),{c(){var n;(n=e.$$.fragment)&&n.c();},m(n,t){T(e,n,t),o=!0;},p(n,o){const r={};var s;2&o&&(r.code=n[1]),4&o&&(r.owner_properties=n[2]),16&o&&(r.sandbox_props=n[4]),8&o&&(r.owner=n[3]),1&o&&(r.json=n[0]),!t&&32&o&&(t=!0,r.proxy=n[5],s=()=>t=!1,$.push(s)),e.$set(r);},i(n){o||(C(e.$$.fragment,n),o=!0);},o(n){L(e.$$.fragment,n),o=!1;},d(n){F(e,n);}}}function Q(n){let e,t,r,s;const a=[G,I],l=[];function u(n,e){return n[1]?0:1}return e=u(n),t=l[e]=a[e](n),{c(){t.c(),r=d("");},m(n,t){l[e].m(n,t),i(n,r,t),s=!0;},p(n,[s]){let i=e;e=u(n),e===i?l[e].p(n,s):(S={r:0,c:[],p:S},L(l[i],1,1,(()=>{l[i]=null;})),S.r||o(S.c),S=S.p,t=l[e],t||(t=l[e]=a[e](n),t.c()),C(t,1),t.m(r.parentNode,r));},i(n){s||(C(t),s=!0);},o(n){L(t),s=!1;},d(n){l[e].d(n),n&&c(r);}}}function V(n,e,t){const o=m();let{data:r={}}=e,{code:s=""}=e,{owner_properties:a={}}=e,{owner:i="0x0000000000000000000000000000000000000000"}=e,{sandbox_props:c=""}=e;let l=null;return h((async()=>{"string"==typeof r&&await fetch(r).then((n=>n.json())).then((n=>t(0,r=n))).catch((n=>{o("warning",new Error("Error while fetching NFT's JSON at "+r)),t(0,r=null);})),r?(a&&"string"==typeof a&&await fetch(a).then((n=>n.json())).then((n=>t(2,a=n))).catch((n=>{o("warning",`Error while fetching owner_properties on ${a}.\n            Setting owner_properties to default.`),t(2,a={});})),!s&&r.interactive_nft&&(r.interactive_nft.code?(t(1,s=r.interactive_nft.code),t(0,r.interactive_nft.code=null,r)):r.interactive_nft.code_uri&&await fetch(r.interactive_nft.code_uri).then((n=>n.text())).then((n=>t(1,s=n))).catch((n=>{o("Error",new Error("Error while fetching "+r.interactive_nft.code_uri));}))),s||o("Error",new Error("You need to provide code for this NFT to run"))):o("error",new Error("You need to provide a data property.\n      Either a valid uri to the NFT JSON or the parsed NFT JSON."));})),n.$$set=n=>{"data"in n&&t(0,r=n.data),"code"in n&&t(1,s=n.code),"owner_properties"in n&&t(2,a=n.owner_properties),"owner"in n&&t(3,i=n.owner),"sandbox_props"in n&&t(4,c=n.sandbox_props);},[r,s,a,i,c,l,"0.0.4",function(){return l},function(n){l=n,t(5,l);},function(e){v(n,e);},function(e){v(n,e);},function(e){v(n,e);}]}class Sandbox extends D{constructor(n){super(),P(this,n,V,Q,s,{data:0,code:1,owner_properties:2,owner:3,sandbox_props:4,version:6,getProxy:7});}get version(){return this.$$.ctx[6]}get getProxy(){return this.$$.ctx[7]}}

    /* src/components/Token.svelte generated by Svelte v3.29.4 */
    const file = "src/components/Token.svelte";

    function add_css() {
    	var style = element("style");
    	style.id = "svelte-lh0bc7-style";
    	style.textContent = ".beyondembeddable__wrapper.resizable.svelte-lh0bc7.svelte-lh0bc7{position:relative}em.svelte-lh0bc7.svelte-lh0bc7{position:absolute;top:100%;font-size:0.8em;right:0;z-index:0}.beyondembeddable__sandbox.svelte-lh0bc7.svelte-lh0bc7{width:100%;height:100%}.beyondembeddable__wrapper.resizable.svelte-lh0bc7 .beyondembeddable__sandbox.svelte-lh0bc7{position:absolute;top:0;left:0;right:0;bottom:0;min-width:100%;min-height:100%;z-index:1;resize:both;overflow:auto}img.svelte-lh0bc7.svelte-lh0bc7{width:100%;height:auto}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVG9rZW4uc3ZlbHRlIiwic291cmNlcyI6WyJUb2tlbi5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdD5cbiAgaW1wb3J0IHsgY3JlYXRlRXZlbnREaXNwYXRjaGVyLCBvbk1vdW50IH0gZnJvbSAnc3ZlbHRlJztcbiAgaW1wb3J0IFNhbmRib3ggZnJvbSAnQGJleW9uZG5mdC9zYW5kYm94JztcblxuICBleHBvcnQgbGV0IG93bmVyO1xuICBleHBvcnQgbGV0IHVyaXM7XG4gIGV4cG9ydCBsZXQgcmVzaXphYmxlO1xuICBleHBvcnQgbGV0IHdpZHRoO1xuICBleHBvcnQgbGV0IGhlaWdodDtcblxuICBjb25zdCBkaXNwYXRjaCA9IGNyZWF0ZUV2ZW50RGlzcGF0Y2hlcigpO1xuXG4gIGxldCBsb2FkZWQgPSBmYWxzZTtcbiAgbGV0IGpzb247XG4gIGxldCBvd25lcl9wcm9wZXJ0aWVzID0ge307XG4gIGxldCB2aWV3O1xuXG4gICQ6IHtcbiAgICBpZiAobG9hZGVkICYmIHZpZXcpIHtcbiAgICAgIGlmIChqc29uLmludGVyYWN0aXZlX25mdCkge1xuICAgICAgICBjb25zdCBwcm9wcyA9IHtcbiAgICAgICAgICBkYXRhOiBqc29uLFxuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChvd25lcikge1xuICAgICAgICAgIHByb3BzLm93bmVyID0gb3duZXI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3duZXJfcHJvcGVydGllcykge1xuICAgICAgICAgIHByb3BzLm93bmVyX3Byb3BlcnRpZXMgPSBvd25lcl9wcm9wZXJ0aWVzO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2FuZGJveCA9IG5ldyBTYW5kYm94KHtcbiAgICAgICAgICB0YXJnZXQ6IHZpZXcsXG4gICAgICAgICAgcHJvcHMsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNhbmRib3guJG9uKCdlcnJvcicsIChlKSA9PiB7XG4gICAgICAgICAgZGlzcGF0Y2goJ2Vycm9yJywgZS5kZXRhaWwpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBvbk1vdW50KGFzeW5jICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgbGV0IHJlcztcbiAgICAgIGlmICh1cmlzLnRva2VuVVJJKSB7XG4gICAgICAgIHJlcyA9IGF3YWl0IGZldGNoKHVyaXMudG9rZW5VUkkpO1xuICAgICAgICBqc29uID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHVyaXMuaW50ZXJhY3RpdmVDb25mVVJJKSB7XG4gICAgICAgIHJlcyA9IGF3YWl0IGZldGNoKHVyaXMuaW50ZXJhY3RpdmVDb25mVVJJKTtcbiAgICAgICAgb3duZXJfcHJvcGVydGllcyA9IGF3YWl0IHJlcy5qc29uKCk7XG4gICAgICB9XG5cbiAgICAgIGxvYWRlZCA9IHRydWU7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZGlzcGF0Y2goJ2Vycm9yJywgJ0Vycm9yIHdoaWxlIGxvYWRpbmcgTkZUIEpTT05zLicpO1xuICAgIH1cbiAgfSk7XG48L3NjcmlwdD5cblxuPHN0eWxlPlxuICAuYmV5b25kZW1iZWRkYWJsZV9fd3JhcHBlci5yZXNpemFibGUge1xuICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgfVxuXG4gIGVtIHtcbiAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgdG9wOiAxMDAlO1xuICAgIGZvbnQtc2l6ZTogMC44ZW07XG4gICAgcmlnaHQ6IDA7XG4gICAgei1pbmRleDogMDtcbiAgfVxuXG4gIC5iZXlvbmRlbWJlZGRhYmxlX19zYW5kYm94IHtcbiAgICB3aWR0aDogMTAwJTtcbiAgICBoZWlnaHQ6IDEwMCU7XG4gIH1cblxuICAuYmV5b25kZW1iZWRkYWJsZV9fd3JhcHBlci5yZXNpemFibGUgLmJleW9uZGVtYmVkZGFibGVfX3NhbmRib3gge1xuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICB0b3A6IDA7XG4gICAgbGVmdDogMDtcbiAgICByaWdodDogMDtcbiAgICBib3R0b206IDA7XG4gICAgbWluLXdpZHRoOiAxMDAlO1xuICAgIG1pbi1oZWlnaHQ6IDEwMCU7XG4gICAgei1pbmRleDogMTtcbiAgICByZXNpemU6IGJvdGg7XG4gICAgb3ZlcmZsb3c6IGF1dG87XG4gIH1cblxuICBpbWcge1xuICAgIHdpZHRoOiAxMDAlO1xuICAgIGhlaWdodDogYXV0bztcbiAgfVxuPC9zdHlsZT5cblxueyNpZiAhbG9hZGVkfVxuICBMb2FkaW5nLi4uXG57OmVsc2V9XG4gIDxkaXZcbiAgICBjbGFzcz1cImJleW9uZGVtYmVkZGFibGVfX3dyYXBwZXJcIlxuICAgIGNsYXNzOnJlc2l6YWJsZVxuICAgIHN0eWxlPXtgd2lkdGg6ICR7d2lkdGh9OyBoZWlnaHQ6ICR7aGVpZ2h0fWB9PlxuICAgIHsjaWYganNvbi5pbnRlcmFjdGl2ZV9uZnR9XG4gICAgICA8ZGl2IGNsYXNzPVwiYmV5b25kZW1iZWRkYWJsZV9fc2FuZGJveFwiIGJpbmQ6dGhpcz17dmlld30gLz5cbiAgICAgIHsjaWYgcmVzaXphYmxlfTxlbT5yZXNpemUgaWYgbmVlZGVkPC9lbT57L2lmfVxuICAgIHs6ZWxzZX1cbiAgICAgIDwhLS0gVE9ETzogaW50ZWdyYXRlIG90aGVyIHR5cGVzIG9mIE5GVCAtLT5cbiAgICAgIDxpbWdcbiAgICAgICAgY2xhc3M9XCJiZXlvbmRlbWJlZGRhYmxlX19mYWxsYmFja1wiXG4gICAgICAgIHNyYz17anNvbi5pbWFnZS5yZXBsYWNlKCdpcGZzOi8vJywgJ2h0dHBzOi8vZ2F0ZXdheS5pcGZzLmlvLycpfVxuICAgICAgICBhbHQ9e2pzb24ubmFtZX0gLz5cbiAgICB7L2lmfVxuICA8L2Rpdj5cbnsvaWZ9XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBaUVFLDBCQUEwQixVQUFVLDRCQUFDLENBQUMsQUFDcEMsUUFBUSxDQUFFLFFBQVEsQUFDcEIsQ0FBQyxBQUVELEVBQUUsNEJBQUMsQ0FBQyxBQUNGLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLEdBQUcsQ0FBRSxJQUFJLENBQ1QsU0FBUyxDQUFFLEtBQUssQ0FDaEIsS0FBSyxDQUFFLENBQUMsQ0FDUixPQUFPLENBQUUsQ0FBQyxBQUNaLENBQUMsQUFFRCwwQkFBMEIsNEJBQUMsQ0FBQyxBQUMxQixLQUFLLENBQUUsSUFBSSxDQUNYLE1BQU0sQ0FBRSxJQUFJLEFBQ2QsQ0FBQyxBQUVELDBCQUEwQix3QkFBVSxDQUFDLDBCQUEwQixjQUFDLENBQUMsQUFDL0QsUUFBUSxDQUFFLFFBQVEsQ0FDbEIsR0FBRyxDQUFFLENBQUMsQ0FDTixJQUFJLENBQUUsQ0FBQyxDQUNQLEtBQUssQ0FBRSxDQUFDLENBQ1IsTUFBTSxDQUFFLENBQUMsQ0FDVCxTQUFTLENBQUUsSUFBSSxDQUNmLFVBQVUsQ0FBRSxJQUFJLENBQ2hCLE9BQU8sQ0FBRSxDQUFDLENBQ1YsTUFBTSxDQUFFLElBQUksQ0FDWixRQUFRLENBQUUsSUFBSSxBQUNoQixDQUFDLEFBRUQsR0FBRyw0QkFBQyxDQUFDLEFBQ0gsS0FBSyxDQUFFLElBQUksQ0FDWCxNQUFNLENBQUUsSUFBSSxBQUNkLENBQUMifQ== */";
    	append_dev(document.head, style);
    }

    // (104:0) {:else}
    function create_else_block(ctx) {
    	let div;
    	let div_style_value;

    	function select_block_type_1(ctx, dirty) {
    		if (/*json*/ ctx[4].interactive_nft) return create_if_block_1;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			attr_dev(div, "class", "beyondembeddable__wrapper svelte-lh0bc7");
    			attr_dev(div, "style", div_style_value = `width: ${/*width*/ ctx[1]}; height: ${/*height*/ ctx[2]}`);
    			toggle_class(div, "resizable", /*resizable*/ ctx[0]);
    			add_location(div, file, 104, 2, 1841);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_block.m(div, null);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}

    			if (dirty & /*width, height*/ 6 && div_style_value !== (div_style_value = `width: ${/*width*/ ctx[1]}; height: ${/*height*/ ctx[2]}`)) {
    				attr_dev(div, "style", div_style_value);
    			}

    			if (dirty & /*resizable*/ 1) {
    				toggle_class(div, "resizable", /*resizable*/ ctx[0]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(104:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (102:0) {#if !loaded}
    function create_if_block(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Loading...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(102:0) {#if !loaded}",
    		ctx
    	});

    	return block;
    }

    // (112:4) {:else}
    function create_else_block_1(ctx) {
    	let img;
    	let img_src_value;
    	let img_alt_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "beyondembeddable__fallback svelte-lh0bc7");
    			if (img.src !== (img_src_value = /*json*/ ctx[4].image.replace("ipfs://", "https://gateway.ipfs.io/"))) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*json*/ ctx[4].name);
    			add_location(img, file, 113, 6, 2170);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*json*/ 16 && img.src !== (img_src_value = /*json*/ ctx[4].image.replace("ipfs://", "https://gateway.ipfs.io/"))) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*json*/ 16 && img_alt_value !== (img_alt_value = /*json*/ ctx[4].name)) {
    				attr_dev(img, "alt", img_alt_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(112:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (109:4) {#if json.interactive_nft}
    function create_if_block_1(ctx) {
    	let div;
    	let t;
    	let if_block_anchor;
    	let if_block = /*resizable*/ ctx[0] && create_if_block_2(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr_dev(div, "class", "beyondembeddable__sandbox svelte-lh0bc7");
    			add_location(div, file, 109, 6, 1991);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			/*div_binding*/ ctx[8](div);
    			insert_dev(target, t, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*resizable*/ ctx[0]) {
    				if (if_block) ; else {
    					if_block = create_if_block_2(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			/*div_binding*/ ctx[8](null);
    			if (detaching) detach_dev(t);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(109:4) {#if json.interactive_nft}",
    		ctx
    	});

    	return block;
    }

    // (111:6) {#if resizable}
    function create_if_block_2(ctx) {
    	let em;

    	const block = {
    		c: function create() {
    			em = element("em");
    			em.textContent = "resize if needed";
    			attr_dev(em, "class", "svelte-lh0bc7");
    			add_location(em, file, 110, 21, 2071);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, em, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(em);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(111:6) {#if resizable}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (!/*loaded*/ ctx[3]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Token", slots, []);
    	let { owner } = $$props;
    	let { uris } = $$props;
    	let { resizable } = $$props;
    	let { width } = $$props;
    	let { height } = $$props;
    	const dispatch = createEventDispatcher();
    	let loaded = false;
    	let json;
    	let owner_properties = {};
    	let view;

    	onMount(async () => {
    		try {
    			let res;

    			if (uris.tokenURI) {
    				res = await fetch(uris.tokenURI);
    				$$invalidate(4, json = await res.json());
    			}

    			if (uris.interactiveConfURI) {
    				res = await fetch(uris.interactiveConfURI);
    				$$invalidate(9, owner_properties = await res.json());
    			}

    			$$invalidate(3, loaded = true);
    		} catch(e) {
    			dispatch("error", "Error while loading NFT JSONs.");
    		}
    	});

    	const writable_props = ["owner", "uris", "resizable", "width", "height"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Token> was created with unknown prop '${key}'`);
    	});

    	function div_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			view = $$value;
    			$$invalidate(5, view);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ("owner" in $$props) $$invalidate(6, owner = $$props.owner);
    		if ("uris" in $$props) $$invalidate(7, uris = $$props.uris);
    		if ("resizable" in $$props) $$invalidate(0, resizable = $$props.resizable);
    		if ("width" in $$props) $$invalidate(1, width = $$props.width);
    		if ("height" in $$props) $$invalidate(2, height = $$props.height);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		onMount,
    		Sandbox,
    		owner,
    		uris,
    		resizable,
    		width,
    		height,
    		dispatch,
    		loaded,
    		json,
    		owner_properties,
    		view
    	});

    	$$self.$inject_state = $$props => {
    		if ("owner" in $$props) $$invalidate(6, owner = $$props.owner);
    		if ("uris" in $$props) $$invalidate(7, uris = $$props.uris);
    		if ("resizable" in $$props) $$invalidate(0, resizable = $$props.resizable);
    		if ("width" in $$props) $$invalidate(1, width = $$props.width);
    		if ("height" in $$props) $$invalidate(2, height = $$props.height);
    		if ("loaded" in $$props) $$invalidate(3, loaded = $$props.loaded);
    		if ("json" in $$props) $$invalidate(4, json = $$props.json);
    		if ("owner_properties" in $$props) $$invalidate(9, owner_properties = $$props.owner_properties);
    		if ("view" in $$props) $$invalidate(5, view = $$props.view);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*loaded, view, json, owner, owner_properties*/ 632) {
    			 {
    				if (loaded && view) {
    					if (json.interactive_nft) {
    						const props = { data: json };

    						if (owner) {
    							props.owner = owner;
    						}

    						if (owner_properties) {
    							props.owner_properties = owner_properties;
    						}

    						const sandbox = new Sandbox({ target: view, props });

    						sandbox.$on("error", e => {
    							dispatch("error", e.detail);
    						});
    					}
    				}
    			}
    		}
    	};

    	return [resizable, width, height, loaded, json, view, owner, uris, div_binding];
    }

    class Token extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-lh0bc7-style")) add_css();

    		init(this, options, instance, create_fragment, safe_not_equal, {
    			owner: 6,
    			uris: 7,
    			resizable: 0,
    			width: 1,
    			height: 2
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Token",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*owner*/ ctx[6] === undefined && !("owner" in props)) {
    			console.warn("<Token> was created without expected prop 'owner'");
    		}

    		if (/*uris*/ ctx[7] === undefined && !("uris" in props)) {
    			console.warn("<Token> was created without expected prop 'uris'");
    		}

    		if (/*resizable*/ ctx[0] === undefined && !("resizable" in props)) {
    			console.warn("<Token> was created without expected prop 'resizable'");
    		}

    		if (/*width*/ ctx[1] === undefined && !("width" in props)) {
    			console.warn("<Token> was created without expected prop 'width'");
    		}

    		if (/*height*/ ctx[2] === undefined && !("height" in props)) {
    			console.warn("<Token> was created without expected prop 'height'");
    		}
    	}

    	get owner() {
    		throw new Error("<Token>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set owner(value) {
    		throw new Error("<Token>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get uris() {
    		throw new Error("<Token>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set uris(value) {
    		throw new Error("<Token>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get resizable() {
    		throw new Error("<Token>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set resizable(value) {
    		throw new Error("<Token>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get width() {
    		throw new Error("<Token>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Token>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Token>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Token>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Embeddable.svelte generated by Svelte v3.29.4 */
    const file$1 = "src/Embeddable.svelte";

    // (50:19) 
    function create_if_block_1$1(ctx) {
    	let token;
    	let current;

    	token = new Token({
    			props: {
    				owner: /*owner*/ ctx[0],
    				uris: /*uris*/ ctx[6],
    				resizable: /*resizable*/ ctx[1],
    				width: /*width*/ ctx[2],
    				height: /*height*/ ctx[3]
    			},
    			$$inline: true
    		});

    	token.$on("error", /*error_handler*/ ctx[10]);

    	const block = {
    		c: function create() {
    			create_component(token.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(token, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const token_changes = {};
    			if (dirty & /*owner*/ 1) token_changes.owner = /*owner*/ ctx[0];
    			if (dirty & /*uris*/ 64) token_changes.uris = /*uris*/ ctx[6];
    			if (dirty & /*resizable*/ 2) token_changes.resizable = /*resizable*/ ctx[1];
    			if (dirty & /*width*/ 4) token_changes.width = /*width*/ ctx[2];
    			if (dirty & /*height*/ 8) token_changes.height = /*height*/ ctx[3];
    			token.$set(token_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(token.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(token.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(token, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(50:19) ",
    		ctx
    	});

    	return block;
    }

    // (48:2) {#if error}
    function create_if_block$1(ctx) {
    	let p;
    	let t;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(/*error*/ ctx[5]);
    			attr_dev(p, "class", "beyondembeddable__error");
    			add_location(p, file$1, 48, 4, 1016);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*error*/ 32) set_data_dev(t, /*error*/ ctx[5]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(48:2) {#if error}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block$1, create_if_block_1$1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*error*/ ctx[5]) return 0;
    		if (/*loaded*/ ctx[4]) return 1;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block) if_block.c();
    			attr_dev(div, "class", "beyondembeddable");
    			add_location(div, file$1, 46, 0, 967);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if (~current_block_type_index) {
    					if_blocks[current_block_type_index].p(ctx, dirty);
    				}
    			} else {
    				if (if_block) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block = if_blocks[current_block_type_index];

    					if (!if_block) {
    						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block.c();
    					}

    					transition_in(if_block, 1);
    					if_block.m(div, null);
    				} else {
    					if_block = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d();
    			}
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Embeddable", slots, []);
    	let { contract } = $$props;
    	let { tokenId = null } = $$props;
    	let { owner = null } = $$props;
    	let { network = Networks.mainnet } = $$props;
    	let { resizable = true } = $$props;
    	let { width = "388px" } = $$props;
    	let { height = "560px" } = $$props;
    	let chaindId = Networks.mainnet;

    	if ("string" === typeof network && Networks[network]) {
    		chaindId = Networks[network];
    	} else {
    		chaindId = parseInt(network);
    	}

    	let loaded = false;
    	let error;
    	let proxy;
    	let uris;

    	async function getURIs() {
    		try {
    			proxy = new Proxy(contract, tokenId, chaindId);
    			await proxy.connect();
    			$$invalidate(6, uris = await proxy.uris());
    		} catch(e) {
    			$$invalidate(5, error = e.message);
    		}
    	}

    	const writable_props = ["contract", "tokenId", "owner", "network", "resizable", "width", "height"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Embeddable> was created with unknown prop '${key}'`);
    	});

    	const error_handler = e => $$invalidate(5, error = e.detail.message);

    	$$self.$$set = $$props => {
    		if ("contract" in $$props) $$invalidate(7, contract = $$props.contract);
    		if ("tokenId" in $$props) $$invalidate(8, tokenId = $$props.tokenId);
    		if ("owner" in $$props) $$invalidate(0, owner = $$props.owner);
    		if ("network" in $$props) $$invalidate(9, network = $$props.network);
    		if ("resizable" in $$props) $$invalidate(1, resizable = $$props.resizable);
    		if ("width" in $$props) $$invalidate(2, width = $$props.width);
    		if ("height" in $$props) $$invalidate(3, height = $$props.height);
    	};

    	$$self.$capture_state = () => ({
    		Proxy,
    		Networks,
    		Token,
    		contract,
    		tokenId,
    		owner,
    		network,
    		resizable,
    		width,
    		height,
    		chaindId,
    		loaded,
    		error,
    		proxy,
    		uris,
    		getURIs
    	});

    	$$self.$inject_state = $$props => {
    		if ("contract" in $$props) $$invalidate(7, contract = $$props.contract);
    		if ("tokenId" in $$props) $$invalidate(8, tokenId = $$props.tokenId);
    		if ("owner" in $$props) $$invalidate(0, owner = $$props.owner);
    		if ("network" in $$props) $$invalidate(9, network = $$props.network);
    		if ("resizable" in $$props) $$invalidate(1, resizable = $$props.resizable);
    		if ("width" in $$props) $$invalidate(2, width = $$props.width);
    		if ("height" in $$props) $$invalidate(3, height = $$props.height);
    		if ("chaindId" in $$props) chaindId = $$props.chaindId;
    		if ("loaded" in $$props) $$invalidate(4, loaded = $$props.loaded);
    		if ("error" in $$props) $$invalidate(5, error = $$props.error);
    		if ("proxy" in $$props) proxy = $$props.proxy;
    		if ("uris" in $$props) $$invalidate(6, uris = $$props.uris);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*contract, tokenId, uris*/ 448) {
    			 {
    				if (contract && tokenId !== null) {
    					if (!uris) {
    						getURIs();
    					} else if (uris.tokenURI) {
    						$$invalidate(4, loaded = true);
    					}
    				}
    			}
    		}
    	};

    	return [
    		owner,
    		resizable,
    		width,
    		height,
    		loaded,
    		error,
    		uris,
    		contract,
    		tokenId,
    		network,
    		error_handler
    	];
    }

    class Embeddable extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			contract: 7,
    			tokenId: 8,
    			owner: 0,
    			network: 9,
    			resizable: 1,
    			width: 2,
    			height: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Embeddable",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*contract*/ ctx[7] === undefined && !("contract" in props)) {
    			console.warn("<Embeddable> was created without expected prop 'contract'");
    		}
    	}

    	get contract() {
    		throw new Error("<Embeddable>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set contract(value) {
    		throw new Error("<Embeddable>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get tokenId() {
    		throw new Error("<Embeddable>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set tokenId(value) {
    		throw new Error("<Embeddable>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get owner() {
    		throw new Error("<Embeddable>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set owner(value) {
    		throw new Error("<Embeddable>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get network() {
    		throw new Error("<Embeddable>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set network(value) {
    		throw new Error("<Embeddable>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get resizable() {
    		throw new Error("<Embeddable>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set resizable(value) {
    		throw new Error("<Embeddable>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get width() {
    		throw new Error("<Embeddable>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Embeddable>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Embeddable>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Embeddable>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    return Embeddable;

})));

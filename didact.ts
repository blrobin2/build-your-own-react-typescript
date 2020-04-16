type Props = { [any: string]: any }
type PropsWithChildren<A> = {
  children: Array<A | Text>,
  [x: string]: any
}
type ElementT = {
  type: string,
  props: PropsWithChildren<ElementT>
}

type Effect = 'UPDATE' | 'PLACEMENT' | 'DELETION'
type Action<A> = (x: A) => A
type Hook<A> = {
  state: A,
  queue: Array<Action<A>>
}

type Fiber = {
  dom?: HTMLElement | Text,
  type?: string | Function,
  child?: Fiber,
  parent?: Fiber,
  sibling?: Fiber,
  alternate?: Fiber,
  effectTag?: Effect,
  hooks?: Array<Hook<any>>,
  props: PropsWithChildren<ElementT>
}

type IdleDeadline = {
  timeRemaining(): DOMHighResTimeStamp
};

declare function requestIdleCallback(func: (deadline: IdleDeadline) => void): void;

const isEvent = (key: string): boolean => key.startsWith('on');
const getEventType = (eventKey: string): string =>
  eventKey.toLowerCase().substring(2);
const isProperty = (key: string): boolean =>
  key !== 'children' && !isEvent(key);
const isNew = (prev: Object, next: Object) =>(key: string): boolean =>
  prev[key] !== next[key];
const isGone = (_prev: Object, next: Object) => (key: string): boolean =>
  !(key in next);
const isFunctionComponent = (fiber: Fiber) =>
  fiber.type instanceof Function;

class _DidactT {
  private nextUnitOfWork: Fiber | null;
  private wipRoot: Fiber | null;
  private currentRoot: Fiber | null;
  private deletions: Array<Fiber>;

  private wipFiber: Fiber | null;
  private hookIndex: number;

  constructor() {
    this.nextUnitOfWork = null;
    this.currentRoot = null;
    this.wipRoot = null;
    this.deletions = [];
    requestIdleCallback(this.workLoop.bind(this));
  }

  public createElement(
    type: string,
    props?: Props,
    ...children: Array<ElementT | string>
  ): ElementT {

    const el = {
      type,
      props: {
        ...props,
        children: children.map(child => {
          if (typeof child === 'object') return child
          return this.createTextElement(child)
        })
      }
    };

    return el;
  }

  public render(element: ElementT, container: HTMLElement): void {
    this.wipRoot = {
      dom: container,
      props: {
        children: [element]
      },
      alternate: this.currentRoot
    };
    this.deletions = [];
    this.nextUnitOfWork = this.wipRoot;
  }

  public useState<A>(initial: A): [A, (a: Action<A>) => void] {
    const oldHook: Hook<A> =
      this.wipFiber.alternate &&
      this.wipFiber.alternate.hooks &&
      this.wipFiber.alternate.hooks[this.hookIndex];

    const hook: Hook<A> = {
      state: oldHook ? oldHook.state : initial,
      queue: []
    };

    const actions: Array<Action<A>> = oldHook ? oldHook.queue : [];
    actions.forEach((action: Action<A>) => {
      hook.state = action(hook.state);
    });

    const setState = (action: Action<A>): void => {
      hook.queue.push(action);
      this.wipRoot = {
        dom: this.currentRoot.dom,
        props: this.currentRoot.props,
        alternate: this.currentRoot
      };
      this.nextUnitOfWork = this.wipRoot;
      this.deletions = [];
    };

    this.wipFiber.hooks.push(hook);
    this.hookIndex++;
    return [hook.state, setState];
  }

  private createTextElement(text: string): ElementT {
    return {
      type: 'TEXT_ELEMENT',
      props: {
        nodeValue: text,
        children: []
      }
    }
  }

  private createDom(fiber: Fiber): HTMLElement | Text {
    const dom: HTMLElement | Text = (() => {
      if (fiber.type === 'TEXT_ELEMENT') return document.createTextNode('');
      if (!(fiber.type instanceof Function)) return document.createElement(fiber.type);
    })();

    this.updateDom(dom, {}, fiber.props);

    return dom;
  }

  private updateDom(dom: HTMLElement | Text, prevProps: Props, nextProps: Props) {
    // Remove old or changed event listeners
    Object.keys(prevProps)
      .filter(isEvent)
      .filter(key => {
        return !(key in nextProps) &&
          isNew(prevProps, nextProps)(key)
      })
      .forEach(name => {
        const eventType = getEventType(name);
        dom.removeEventListener(eventType, prevProps[name]);
      })

    // Remove old properties
    Object.keys(prevProps)
      .filter(isProperty)
      .filter(isGone(prevProps, nextProps))
      .forEach(name => {
        dom[name] = '';
      });

    // Set new or changed properties
    Object.keys(nextProps)
      .filter(isProperty)
      .filter(isNew(prevProps, nextProps))
      .forEach(name => {
        dom[name] = nextProps[name];
      });

    // Add event listeners
    Object.keys(nextProps)
      .filter(isEvent)
      .filter(isNew(prevProps, nextProps))
      .forEach(name => {
        const eventType = getEventType(name);
        dom.addEventListener(eventType, nextProps[name]);
      });
  }

  private commitRoot() {
    this.deletions.forEach(this.commitWork.bind(this));
    this.commitWork(this.wipRoot.child);
    this.currentRoot = this.wipRoot;
    this.wipRoot = null;
  }

  private commitWork(fiber?: Fiber) {
    if (!fiber) return;

    let domParentFiber = fiber.parent;
    while (!domParentFiber.dom) {
      domParentFiber = domParentFiber.parent;
    }
    const domParent = domParentFiber.dom;

    if (
      fiber.effectTag === 'PLACEMENT' &&
      fiber.dom != null
    ) {
      domParent.appendChild(fiber.dom);
    } else if (fiber.effectTag === 'UPDATE' && fiber.dom != null) {
      this.updateDom(
        fiber.dom,
        fiber.alternate.props,
        fiber.props
      );
    } else if (fiber.effectTag === 'DELETION') {
      this.commitDeletion(fiber, domParent);
    }

    this.commitWork(fiber.child);
    this.commitWork(fiber.sibling);
  }

  private commitDeletion(fiber: Fiber, domParent: HTMLElement | Text) {
    if (fiber.dom) {
      domParent.removeChild(fiber.dom);
    } else {
      this.commitDeletion(fiber.child, domParent);
    }
  }

  private workLoop(deadline: IdleDeadline) {
    let shouldYield = false;
    while (this.nextUnitOfWork && !shouldYield) {
      this.nextUnitOfWork = this.performUnitOfWork(this.nextUnitOfWork);
      shouldYield = deadline.timeRemaining() < 1;
    }

    if (!this.nextUnitOfWork && this.wipRoot) {
      this.commitRoot();
    }

    requestIdleCallback(this.workLoop.bind(this));
  }

  private performUnitOfWork(fiber: Fiber): Fiber | null {
    if (isFunctionComponent(fiber)) {
      this.updateFunctionComponent(fiber);
    } else {
      this.updateHostComponent(fiber);
    }

    if (fiber.child) return fiber.child;

    let nextFiber: Fiber | null = fiber;
    while (nextFiber) {
      if (nextFiber.sibling) {
        return nextFiber.sibling;
      }
      nextFiber = nextFiber.parent;
    }
  }

  private updateFunctionComponent(fiber: Fiber) {
    if (fiber.type instanceof Function) {
      this.wipFiber = fiber;
      this.hookIndex = 0;
      this.wipFiber.hooks = [];
      const children = [fiber.type(fiber.props)];
      this.reconcileChildren(fiber, children);
    }
  }

  private updateHostComponent(fiber: Fiber) {
    if (!fiber.dom) {
      fiber.dom = this.createDom(fiber);
    }

    const elements = fiber.props.children;
    this.reconcileChildren(fiber, elements);
  }

  private reconcileChildren(wipFiber: Fiber, elements: Array<ElementT | Text>) {
    let index = 0;
    let oldFiber: Fiber | null = wipFiber.alternate && wipFiber.alternate.child;
    let prevSibling: Fiber | null = null;

    while (
      index < elements.length
      || oldFiber != null
    ) {
      const element: ElementT | Text = elements[index];
      let newFiber: Fiber | null = null;

      const sameType: boolean = oldFiber &&
        element &&
        ('type' in element) &&
        ('type' in oldFiber) &&
        element.type === oldFiber.type;

      if (sameType) {
        newFiber = {
          type: oldFiber.type,
          props: ('props' in element) ? element.props : null,
          dom: oldFiber.dom,
          parent: wipFiber,
          alternate: oldFiber,
          effectTag: 'UPDATE'
        };
      }
      if (element && !sameType) {
        newFiber = {
          type: ('type' in element) ? element.type : null,
          props: ('props' in element) ? element.props : null,
          dom: null,
          parent: wipFiber,
          alternate: null,
          effectTag: 'PLACEMENT'
        };
      }
      if (oldFiber && !sameType) {
        oldFiber.effectTag = 'DELETION';
        this.deletions.push(oldFiber);
      }

      if (oldFiber) {
        oldFiber = oldFiber.sibling;
      }
      if (index === 0) {
        wipFiber.child = newFiber;
      } else {
        prevSibling.sibling = newFiber;
      }

      prevSibling = newFiber;
      index++;
    }
  }
}

const didact = new _DidactT();
export const createElement = didact.createElement.bind(didact);
export const render = didact.render.bind(didact);
export const useState = didact.useState.bind(didact);

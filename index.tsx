import { createElement, render, useState } from './didact.ts';

// const element = createElement(
//   'div',
//   { id: 'foo', onClick: (() => { console.log('clicked') }) },
//   createElement('a', null, 'bar'),
//   createElement('b')
// );

/** @jsx createElement */
// const element = (
//   <div id="foo" onClick={ () => console.log('clicked') }>
//     <a>bar</a>
//     <b></b>
//   </div>
// );

/** @jsx createElement */
// function App(props) {
//   return <h1>Hi {props.name}</h1>;
// }
// const element = <App name="foo" />;

/** @jsx createElement */
function Counter() {
  const [state, setState] = useState<number>(1);
  return (
    <h1>
      Count: {state}<br />
      <button onClick={() => setState((c: number) => c + 1)}>+</button>
      <button onClick={() => setState((c: number) => c - 1)}>-</button>
    </h1>
  );
}
const element = <Counter/>;

const container = document.getElementById('root');
render(element, container);
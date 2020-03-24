import { useState, useContext, useEffect } from 'react';
import {
  FunctionArgs,
  FunctionResult,
  UnpackPromise,
  DSL,
} from 'yoshi-server/types';
import { HttpContext } from './context';

type State<Result> =
  | { loading: true; data: null; error: null }
  | { loading: false; data: UnpackPromise<Result>; error: null }
  | {
      loading: false;
      data: null;
      error: Error;
    };

export function useRequest<
  Result extends FunctionResult,
  Args extends FunctionArgs
>(dsl: DSL<Result, Args>, ...args: Args): State<Result> {
  const context = useContext(HttpContext);

  const [state, setState] = useState<State<Result>>({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    context!.client!.request({ method: dsl, args }).then(
      data => setState({ ...state, loading: false, data, error: null }),
      error => setState({ ...state, loading: false, data: null, error }),
    );
  }, []);

  return state;
}

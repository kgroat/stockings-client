
export type MergeStrategyString = 'replace' | 'append' | 'prepend' | 'upsert'

export type MergeStrategy<T> = (a: T, b: any) => T

type MergeStrategyInner = (
  (<A>(a: A, b: A) => A) | 
  (<B>(a: B[], b: B) => B[]) | 
  (<A, B>(a: A, b: B) => A)
)

const replace: MergeStrategyString = 'replace'
const append: MergeStrategyString = 'append'
const prepend: MergeStrategyString = 'prepend'
const upsert: MergeStrategyString = 'upsert'

const REPLACE_MERGE_STRATEGY = <T>(original: T, current: T): T => current;
const APPEND_MERGE_STRATEGY = <T>(list: T[], current: T): T[] => [...list, current];
const PREPEND_MERGE_STRATEGY = <T>(list: T[], current: T): T[] => [current, ...list];
const UPSERT_MERGE_STRATEGY = function (key: string) {
  return <T>(list: T[], current: T): T[] => {
    const index = list.findIndex(item => item[key] === current[key])
    if (index < 0) {
      return [...list, current]
    } else {
      return [
        ...list.slice(0, index-1),
        current,
        ...list.slice(index)
      ]
    }
  }
}
const DEFAULT_MERGE_STRATEGY = REPLACE_MERGE_STRATEGY;

interface StrategyMap {
  [key: string]: (key?: string) => MergeStrategyInner
}

const strategyMap: StrategyMap = {
  [replace]: () => REPLACE_MERGE_STRATEGY,
  [append]: () => APPEND_MERGE_STRATEGY,
  [prepend]: () => PREPEND_MERGE_STRATEGY,
  [upsert]: UPSERT_MERGE_STRATEGY
}

export function hydrateMergeStrategy<T>(mergeStrategyString: MergeStrategyString, upsertKey?: string): MergeStrategy<T> {
  if(!mergeStrategyString){
    return DEFAULT_MERGE_STRATEGY;
  }
  return strategyMap[mergeStrategyString](upsertKey) as MergeStrategy<T>
}
function MergeStrategyError(error: Error, mergeStrategy: string): Error {
  Object.defineProperty(error, 'mergeStrategy', { enumerable: true, writable: false, value: mergeStrategy });
  error.name = 'MergeStrategyError';
  return error;
}

function validateCurlyBraces(body: string): string {
  var curlyCount = 0;
  var isInSingleString = false;
  var isInDoubleString = false;
  var isInTemplateString = false;
  var isInRegex = false;
  for(var char of body){
    if(char === '\'') isInSingleString = !isInSingleString;
    if(isInSingleString) continue;
    
    if(char === '"') isInDoubleString = !isInDoubleString;
    if(isInDoubleString) continue;
    
    if(char === '`') isInTemplateString = !isInTemplateString;
    if(isInTemplateString) continue;

    if(char === '/') isInRegex = !isInRegex;
    if(isInRegex) continue;

    if(char === '{'){
      curlyCount++;
    } else if(char === '}'){
      curlyCount--;
      if(curlyCount < 0){
        return `The merge strategy was terminated unexpectedly`;
      }
    }
  }
  if(curlyCount !== 0){
    return `There were ${curlyCount} unclosed blocks`;
  }
  return null;
}

function validateUseOfEval(body: string): string {
  return body.indexOf('eval') >= 0 ? `Use of eval is not allowed in merge strategies` : null;
}

function validateUseOfThis(body: string): string {
  return body.indexOf('this') >= 0 ? `Use of the 'this' reference is not allowed in merge strategies` : null;
}

function rebuildBody(body: string): string {
  var lines = body.split(/\n/);
  var lineStatements = [lines[0].trim()];
  for(var i=1; i<lines.length; i++){
    let currentLine = lines[i].trim();
    let previousLine = lineStatements[lineStatements.length-1];
    let continuePrevious = previousLine[previousLine.length-1] === '.';
    let continueCurrent = currentLine[0] === '.';
    if(continuePrevious || continueCurrent){
      lineStatements[lineStatements.length-1] = previousLine + currentLine;
    } else {
      lineStatements.push(currentLine);
    }
  }
  return ';' + lineStatements.join(';') + ';';
}

const referenceFinder = /[\s;+\-*/^&!%\(,|\{\}=?<>:](\w+)[\s;+\-*/^&!%\(\),|\}\.\[=?<>:]/g;
const allowedReferences = [
  'return',
  'var',
  'let',
  'const',
  'for',
  'in',
  'of',
  'while',
  'do',
  'continue',
  'break',
  'if',
  'try',
  'catch',
  'null',
  'undefined',
  'new',
  'Math',
  'Date',
  'Number',
  'String',
  'Array',
  'Object'
]
function validateReferences(body: string, parameters: string[]): string {
  var rebuiltBody = rebuildBody(body);
  var references = [];
  var match = referenceFinder.exec(body);
  while(match !== null){
    if(isNaN(parseInt(match[1][0]))){
      references.push(match[1]);
    }
    match = referenceFinder.exec(body);
  }
  var allAllowedRefs = allowedReferences.slice();
  allAllowedRefs.push(...parameters);
  for(var ref of references){
    if(allAllowedRefs.indexOf(ref) < 0){
      return `Disallowed reference used in merge strategy: ${ref}`;
    }
  }
  return null;
}

function validateBody(body: string, parameters: string[]): string {
  return validateCurlyBraces(body)
      || validateUseOfEval(body)
      || validateUseOfThis(body)
      || validateReferences(body, parameters);
}

function validateMergeStrategy(mergeStrategyString: string, body: string, parameters: string[]): string {
  if(mergeStrategyString.indexOf(')=>{') < 1){
    return `Malformed merge strategy.  Lambda expression expected.`;
  }
  if(parameters.length !== 2){
    return `Malformed merge strategy.  Two parameters expected; instead there were ${parameters.length}.`;
  }
  return validateBody(body, parameters);
}

function buildMergeStrategy(mergeStrategyString: string): (a,b)=>any {
  var parameters = getParamNamesFromFunctionString(mergeStrategyString);
  var body = getBodyFromFunctionString(mergeStrategyString);
  
  var validationError = validateMergeStrategy(mergeStrategyString, body, parameters);
  if(validationError){
    throw MergeStrategyError(new Error(validationError), mergeStrategyString);
  }

  return eval(`(function(${parameters[0]},${parameters[1]}){${body}})`);
}

var ARGUMENT_NAMES = /([^\s,]+)/g;
function getParamNamesFromFunctionString(fnStr: string): string[] {
  var result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
  if(result === null)
    result = [];
  return result;
}
function getBodyFromFunctionString(fnStr: string): string {
  if(fnStr.indexOf('{') > 0){
    return fnStr.slice(fnStr.indexOf('{')+1, fnStr.lastIndexOf('}')).trim();
  } else {
    return `return ${fnStr.substring(fnStr.indexOf('=>')).trim()}`;
  }
}

const DEFAULT_MERGE_STRATEGY = (a,b) => b;
export function hydrateMergeStrategy<T>(mergeStrategyString: string): (a: T, b: any) => T {
  if(!mergeStrategyString){
    return DEFAULT_MERGE_STRATEGY;
  }

  return buildMergeStrategy(mergeStrategyString);
}
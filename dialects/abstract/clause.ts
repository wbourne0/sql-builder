import { QueryFactory } from '@lib/factory';
import {
  AbstractOp as Op,
  Operator,
  symbolToOperatorMapping,
  SymbolToOperatorMap,
  operatorFactories,
  OneOp,
  LogicalOperatorFactory,
} from './operators.old';
import {
  Identifier,
  joinQueryParts,
  Stringable,
  Stringer,
  TmpStringer,
  UnnestSingle,
} from '@lib/util';

type SkipFirst<Arr extends Array<any>> = Arr extends [infer _, ...infer Rest]
  ? Rest
  : never;

type ClauseOneOp = {
  [Symbol in Operator['symbol']]: {
    [_ in Symbol]: UnnestSingle<
      SkipFirst<Parameters<SymbolToOperatorMap[Symbol]['build']>>
    >;
  };
}[Operator['symbol']];

type ClauseOptions = Array<
  [identifier: string | Identifier, matchOptions: Stringable | ClauseOneOp]
>;

class ClauseFactory extends QueryFactory {
  build(options: ClauseOptions): string {
    const conditions = [];

    for (const [identifier, matchOptions] of options) {
      if (typeof matchOptions === 'object') {
        const [sym] = Object.getOwnPropertySymbols(matchOptions) as [
          Operator['symbol']
        ];

        const opFactory = symbolToOperatorMapping[sym];

        if (opFactory instanceof LogicalOperatorFactory) {
          opFactory.build();
          continue;
        }

        conditions.push(
          opFactory.build(identifier, (matchOptions as any)[sym])
        );
      } else {
        conditions.push(
          symbolToOperatorMapping[Op.eq].build(identifier, matchOptions)
        );
      }
    }

    return joinQueryParts(conditions, ' AND ');
  }

  _init(stringer: Stringer) {
    super._init(stringer);

    this._initChildren(Object.values(operatorFactories));
  }

  constructor() {
    super();
    this._init(new TmpStringer());
  }
}

const clauseFactory = new ClauseFactory();

console.log(
  clauseFactory.build([
    [new Identifier(['user table', 'username']), 'bob'],
    ['abc', 'def'],
    [new Identifier(['users', 'emails']), { [Op.in]: ['abc'] }],
    [
      new Identifier(['users', 'emails']),
      {
        [Op.or]: [
          { [Op.like]: '%@gmail.com' },
          { [Op.like]: '%@otherMail.com' },
        ],
      },
    ],
  ])
);

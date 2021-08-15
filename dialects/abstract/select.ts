import {
  OptionsFor,
  QueryStatementFactory,
  SegmentFactory,
} from '@lib/statement';
import { Identifier, joinQueryParts, quoteTarget, Stringer } from '@lib/util';
import assert from 'assert';

const orderDirections = ['ASC', 'DESC'] as const;

type OrderDirection = typeof orderDirections[number];

type OrderArg =
  | string
  | [target: string]
  | [target: string, direction: OrderDirection];
type OrderArgs = OrderArg | Array<OrderArg>;

class AbstractSelectFactory extends QueryStatementFactory<
  Readonly<['from']>,
  Readonly<['from', 'orderBy', 'limit']>
> {
  _order = ['from', 'orderBy', 'limit'] as const;
  _required = ['from'] as const;

  build(
    targets: Array<string | Identifier>,
    options: OptionsFor<this> & { distinct?: boolean }
  ): string {
    assert(targets.length > 0, 'expected one or more targets');

    const distinct = options.distinct;
    delete options.distinct;

    return this._build(
      ['SELECT', distinct && 'DISTINCT', targets.map(this.stringer.stringify).join(', ')],
      options
    );
  }

  _resolvers = {
    from(target: string) {
      return joinQueryParts(['FROM', quoteTarget(target)]);
    },
    limit(count: number) {
      assert(typeof count === 'number');
      return joinQueryParts(['LIMIT', count.toString()]);
    },
    orderBy(orderArgs: OrderArgs) {
      if (typeof orderArgs === 'string') {
        return joinQueryParts(['ORDER BY', quoteTarget(orderArgs)]);
      }

      if (
        orderArgs.length === 2 &&
        typeof orderArgs[0] === 'string' &&
        typeof orderArgs[1] === 'string' &&
        orderDirections.includes(orderArgs[1] as OrderDirection)
      ) {
        return joinQueryParts([
          'ORDER BY',
          quoteTarget(orderArgs[0]),
          orderArgs[1],
        ]);
      }

      return joinQueryParts([
        'ORDER BY',
        orderArgs
          .map((v) => {
            if (typeof v === 'string') {
              return quoteTarget(v);
            }

            switch (v.length) {
              case 1:
                return quoteTarget(v[0]);
              case 2:
                assert(orderDirections.includes(v[1]));

                return joinQueryParts([quoteTarget(v[0]), v[1]]);
              default:
                throw new Error(`Invalid order argument received: ${v}`);
            }
          })
          .join(', '),
      ]);
    },
  };
}

const selectFactory = new AbstractSelectFactory() as SegmentFactory<
  Parameters<AbstractSelectFactory['build']>
>;

export default selectFactory;

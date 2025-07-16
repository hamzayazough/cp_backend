/* eslint-disable */
import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';

export const buildSelectQuery = <T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  selectFields: string[],
  whereConditions: Record<string, any> = {},
  orderBy: string = 'createdAt',
  order: 'ASC' | 'DESC' = 'DESC',
  limit: number = 10,
  offset: number = 0,
): SelectQueryBuilder<T> => {
  queryBuilder.select(selectFields);

  Object.entries(whereConditions).forEach(([key, value]) => {
    queryBuilder.andWhere(`${key} = :${key}`, { [key]: value });
  });

  queryBuilder.orderBy(orderBy, order).take(limit).skip(offset);

  return queryBuilder;
};

export const buildCountQuery = <T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  whereConditions: Record<string, any> = {},
): SelectQueryBuilder<T> => {
  Object.entries(whereConditions).forEach(([key, value]) => {
    queryBuilder.andWhere(`${key} = :${key}`, { [key]: value });
  });

  return queryBuilder.select('COUNT(*)', 'total');
};

import { Injectable } from '@nestjs/common';
import { type MessPolicy } from '../domain/mess-policy';
import { MessPolicyRepository } from '../repositories/mess-policy.repository';

/** Loads the current policy once per use case; domain functions receive it as data. */
@Injectable()
export class GetMessPolicyService {
  constructor(private readonly policy: MessPolicyRepository) {}

  execute(): Promise<MessPolicy> {
    return this.policy.get();
  }
}

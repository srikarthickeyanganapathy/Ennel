import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthenticatedStudent {
  id: string;
}

export interface StudentRequest extends Request {
  student?: AuthenticatedStudent;
}

/** The student set by StudentJwtAuthGuard. */
export const CurrentStudent = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedStudent => {
    const student = context.switchToHttp().getRequest<StudentRequest>().student;
    if (!student) throw new Error('CurrentStudent used on a route without StudentJwtAuthGuard');
    return student;
  },
);

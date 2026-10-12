import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { AccountStatus } from '../../common/enums.js';
import type { AuthenticatedUser, JwtPayload } from '../../common/interfaces.js';
import { getValidatedJwtConfig } from '../../config/jwt.util.js';
import { User } from '../../users/entities/user.entity.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getValidatedJwtConfig(config).secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user || user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }
    return { id: user.id, email: user.email, role: user.role };
  }
}

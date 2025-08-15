import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NotificationType } from '../../enums/notification-type';

@Entity('notification_templates')
export class NotificationTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'notification_type',
    type: 'enum',
    enum: NotificationType,
    unique: true,
  })
  notificationType: NotificationType;

  @Column({ name: 'email_subject_template', type: 'text', nullable: true })
  emailSubjectTemplate?: string;

  @Column({ name: 'email_body_template', type: 'text', nullable: true })
  emailBodyTemplate?: string;

  @Column({ name: 'sms_template', type: 'text', nullable: true })
  smsTemplate?: string;

  @Column({ name: 'push_title_template', type: 'text', nullable: true })
  pushTitleTemplate?: string;

  @Column({ name: 'push_body_template', type: 'text', nullable: true })
  pushBodyTemplate?: string;

  @Column({ name: 'in_app_title_template', type: 'text', nullable: true })
  inAppTitleTemplate?: string;

  @Column({ name: 'in_app_body_template', type: 'text', nullable: true })
  inAppBodyTemplate?: string;

  // Template variables documentation
  @Column({ name: 'template_variables', type: 'jsonb', nullable: true })
  templateVariables?: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

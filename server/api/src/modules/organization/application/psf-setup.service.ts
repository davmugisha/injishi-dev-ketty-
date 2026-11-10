import {
  PSF_FORM_FIELDS,
  psfBandName,
  psfBandOverlap,
  psfCodeFrom,
  psfExtraAnswerProblem,
  psfFeeKindsOf,
  psfFormDefaults,
  type AddPsfAssociationRequest,
  type PsfFeeKinds,
  type CreatePsfBandRequest,
  type AddPsfSectorRequest,
  type CreatePsfFormExtraRequest,
  type CreatePsfLevelRequest,
  type OversightGrant,
  type PsfBand,
  type PsfBandsView,
  type PsfExtraAnswers,
  type PsfFormConfig,
  type PsfFormExtra,
  type PsfFormSetupView,
  type PsfMoneyQuery,
  type PsfMoneyView,
  type PsfSplitRateView,
  type SetPsfSplitRateRequest,
  type ChangePsfAssociationRequest,
  type UpdatePsfBandRequest,
  type ChangePsfSectorRequest,
  type UpdatePsfFormExtraRequest,
  type UpdatePsfFormFieldSettingRequest,
  type UpdatePsfLevelRequest,
} from '@injishi/contracts';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { PsfMembershipRepository } from '../infrastructure/psf-membership.repository';
import { PsfReportRepository } from '../infrastructure/psf-report.repository';
import { PsfSetupRepository, type PsfMoneyRow } from '../infrastructure/psf-setup.repository';
import { PsfMembershipService } from './psf-membership.service';

const NATIONAL_ONLY = 'Only the PSF National Manager changes this.';
const KIGALI_OFFSET = '+02:00';
const kigaliToday = (): string => new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);
const midnight = (day: string): Date => new Date(`${day}T00:00:00${KIGALI_OFFSET}`);
const nextDay = (day: string): Date => new Date(midnight(day).getTime() + 24 * 3600 * 1000);

function refused(path: (string | number)[], message: string): UnprocessableEntityException {
  return new UnprocessableEntityException({ message: 'Validation failed', issues: [{ code: 'custom', path, message }] });
}

/**
 * PSF's own setup (2026-11-06, the owner): the split, the levels and bands, and the public form, which
 * the National Manager changes without a release. A Regional or District Manager reads them.
 */
@Injectable()
export class PsfSetupService {
  constructor(
    private readonly repo: PsfSetupRepository,
    private readonly psfRepo: PsfMembershipRepository,
    private readonly psf: PsfMembershipService,
    private readonly reports: PsfReportRepository,
  ) {}

  private isNational(grants: OversightGrant[]): boolean {
    return grants.some((g) => g.oversightRole === 'psf_membership_officer' && g.scopeLevel === 'country');
  }

  private national(grants: OversightGrant[]): void {
    if (!this.isNational(grants)) throw new ForbiddenException(NATIONAL_ONLY);
  }

  // --- The split -----------------------------------------------------------------

  async split(grants: OversightGrant[]): Promise<PsfSplitRateView> {
    const history = await this.repo.splitHistory();
    const districtPercent = history[0]?.districtPercent ?? 60;
    return {
      districtPercent,
      headquartersPercent: 100 - districtPercent,
      canEdit: this.isNational(grants),
      history: history.map((h) => ({ districtPercent: h.districtPercent, setByName: h.setByName, at: h.at.toISOString() })),
    };
  }

  async setSplit(userId: string, grants: OversightGrant[], input: SetPsfSplitRateRequest): Promise<PsfSplitRateView> {
    this.national(grants);
    await this.repo.setSplit(input.districtPercent, userId);
    return this.split(grants);
  }

  /** Who the fees are for, by region and district, at the level this officer covers. */
  async money(grants: OversightGrant[], query: PsfMoneyQuery): Promise<PsfMoneyView> {
    const today = kigaliToday();
    const from = query.from ?? `${today.slice(0, 4)}-01-01`;
    const to = query.to ?? today;
    if (to < from) throw new BadRequestException('The period ends before it starts.');
    const scope = await this.psf.scopeFor(grants);
    const [rows, ledger] = await Promise.all([this.repo.money(scope, midnight(from), nextDay(to), today), this.reports.feeLines(scope, midnight(from), nextDay(to))]);
    const inDistricts = (list: readonly PsfMoneyRow[]): PsfFeeKinds => {
      const ids = new Set(list.map((r) => r.districtId));
      return psfFeeKindsOf(ledger.filter((l) => ids.has(l.districtId)));
    };
    const sum = (list: readonly PsfMoneyRow[]): Pick<PsfMoneyRow, 'totalRwf' | 'districtRwf' | 'headquartersRwf' | 'payments' | 'members'> & { kinds: PsfFeeKinds } => ({
      kinds: inDistricts(list),
      totalRwf: list.reduce((s, r) => s + r.totalRwf, 0),
      districtRwf: list.reduce((s, r) => s + r.districtRwf, 0),
      headquartersRwf: list.reduce((s, r) => s + r.headquartersRwf, 0),
      payments: list.reduce((s, r) => s + r.payments, 0),
      members: list.reduce((s, r) => s + r.members, 0),
    });
    const provinces = [...new Map(rows.map((r) => [r.provinceId, r.provinceName])).entries()];
    const seats = grants.filter((g) => g.oversightRole === 'psf_membership_officer');
    const level = seats.some((g) => g.scopeLevel === 'country') ? 'country' : seats.some((g) => g.scopeLevel === 'province') ? 'province' : 'district';
    return {
      from,
      to,
      level,
      districtPercent: (await this.repo.splitHistory())[0]?.districtPercent ?? 60,
      ourShare: level === 'country' ? 'headquarters' : 'district',
      totals: sum(rows),
      byRegion: provinces
        .map(([provinceId, provinceName]) => ({ provinceId, provinceName, ...sum(rows.filter((r) => r.provinceId === provinceId)) }))
        .sort((a, b) => b.totalRwf - a.totalRwf),
      byDistrict: [...rows].sort((a, b) => b.totalRwf - a.totalRwf).map((r) => ({ ...r, kinds: inDistricts([r]) })),
    };
  }

  // --- Levels and bands ----------------------------------------------------------

  async bands(grants: OversightGrant[], note: string | null = null): Promise<PsfBandsView> {
    const [levels, bands, members] = await Promise.all([this.repo.levels(), this.repo.bands(), this.repo.bandMembers()]);
    return {
      levels: levels.map((l) => ({ code: l.code, name: l.nameEn, blurb: l.blurbEn, sortOrder: l.sortOrder, active: l.active })),
      bands: bands.map((b): PsfBand => ({
        code: b.code,
        level: b.family,
        name: b.nameEn,
        minRwf: b.annualFeeMinRwf ?? b.annualFeeRwf,
        maxRwf: b.annualFeeMaxRwf ?? (b.priceKind === 'fixed' ? b.annualFeeRwf : null),
        sortOrder: b.sortOrder,
        active: b.active,
        cardBadge: b.cardBadge,
        members: members.get(b.code) ?? 0,
      })),
      canEdit: this.isNational(grants),
      note,
    };
  }

  async createLevel(userId: string, grants: OversightGrant[], input: CreatePsfLevelRequest): Promise<PsfBandsView> {
    this.national(grants);
    const levels = await this.repo.levels();
    const code = psfCodeFrom(input.name);
    const sortOrder = Math.max(0, ...levels.filter((l) => l.active).map((l) => l.sortOrder)) + 10;
    if (!(await this.repo.insertLevel({ code, nameEn: input.name, blurbEn: input.blurb ?? null, sortOrder, userId }))) {
      throw new ConflictException('There is already a level with that name.');
    }
    return this.bands(grants);
  }

  async updateLevel(userId: string, grants: OversightGrant[], code: string, input: UpdatePsfLevelRequest): Promise<PsfBandsView> {
    this.national(grants);
    const done = await this.repo.updateLevel(
      code,
      {
        ...(input.name !== undefined ? { nameEn: input.name } : {}),
        ...(input.blurb !== undefined ? { blurbEn: input.blurb } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
      userId,
    );
    if (!done) throw new NotFoundException('That level is not on PSF’s list.');
    return this.bands(grants);
  }

  private async assertNoOverlap(range: { code?: string; minRwf: number; maxRwf: number | null }, path: string): Promise<void> {
    const view = await this.bands([]);
    const hit = psfBandOverlap(view.bands, range);
    if (hit) throw refused([path], `This range overlaps “${hit.name}”. Change that band first, or pick another range.`);
  }

  async createBand(userId: string, grants: OversightGrant[], input: CreatePsfBandRequest): Promise<PsfBandsView> {
    this.national(grants);
    const level = (await this.repo.levels()).find((l) => l.code === input.level);
    if (!level || !level.active) throw refused(['level'], 'Pick a level PSF still offers.');
    await this.assertNoOverlap({ minRwf: input.minRwf, maxRwf: input.maxRwf }, 'minRwf');
    const inserted = await this.repo.insertBand({
      code: `${level.code}_${input.minRwf}`,
      family: level.code,
      nameEn: input.name || psfBandName(level.nameEn, input.minRwf, input.maxRwf),
      minRwf: input.minRwf,
      maxRwf: input.maxRwf,
      cardBadge: input.cardBadge || null,
      sortOrder: Math.min(999, level.sortOrder * 10 + 1),
      userId,
    });
    if (!inserted) throw new ConflictException('A band starting at this amount existed before. Open it in the list and bring it back.');
    return this.bands(grants);
  }

  async updateBand(userId: string, grants: OversightGrant[], code: string, input: UpdatePsfBandRequest): Promise<PsfBandsView> {
    this.national(grants);
    const band = (await this.bands(grants)).bands.find((b) => b.code === code);
    if (!band) throw new NotFoundException('That band is not on PSF’s list.');
    const minRwf = input.minRwf ?? band.minRwf;
    const maxRwf = input.maxRwf !== undefined ? input.maxRwf : band.maxRwf;
    if (minRwf !== null && maxRwf !== null && maxRwf <= minRwf) throw refused(['maxRwf'], 'The most must be above the least.');
    const rangeChanged = minRwf !== band.minRwf || maxRwf !== band.maxRwf;
    const willBeActive = input.active ?? band.active;
    if (minRwf !== null && willBeActive && (rangeChanged || !band.active)) await this.assertNoOverlap({ code, minRwf, maxRwf }, 'minRwf');
    // A band still named by its range follows the new one; a name PSF chose stays.
    const levelName = (await this.repo.levels()).find((l) => l.code === band.level)?.nameEn ?? band.level;
    const followsRange = band.minRwf !== null && band.name === psfBandName(levelName, band.minRwf, band.maxRwf);
    const nameEn = input.name || (rangeChanged && followsRange && minRwf !== null ? psfBandName(levelName, minRwf, maxRwf) : undefined);
    const cleared = await this.repo.updateBand(
      code,
      {
        ...(nameEn ? { nameEn } : {}),
        ...(input.cardBadge !== undefined ? { cardBadge: input.cardBadge || null } : {}),
        ...(rangeChanged && minRwf !== null ? { minRwf, maxRwf } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
      userId,
    );
    return this.bands(grants, cleared > 0 ? `${cleared} price${cleared === 1 ? '' : 's'} set for this band no longer fit the range and went back to the band’s start.` : null);
  }

  // --- The form ------------------------------------------------------------------

  /** What the public form asks: PSF's settings over the form's own wording. */
  async formConfig(): Promise<PsfFormConfig> {
    const [settings, extras] = await Promise.all([this.repo.formSettings(), this.repo.extras()]);
    return {
      fields: psfFormDefaults()
        .map((d) => {
          const s = settings.find((x) => x.fieldKey === d.key);
          if (!s) return d;
          return {
            ...d,
            label: s.label ?? d.label,
            help: s.helpText !== null ? s.helpText || null : d.help,
            // A locked field shows, and stays as the form needs it, whatever a row says.
            required: d.locked ? d.required : (s.required ?? d.required),
            visible: d.locked ? true : s.visible,
            sortOrder: s.sortOrder ?? d.sortOrder,
          };
        })
        .sort((a, b) => a.sortOrder - b.sortOrder),
      extras: extras.map(
        (e): PsfFormExtra => ({
          id: e.id,
          key: e.key,
          step: e.step as PsfFormExtra['step'],
          label: e.label,
          help: e.helpText,
          fieldType: e.fieldType as PsfFormExtra['fieldType'],
          required: e.required,
          options: e.options ?? [],
          sortOrder: e.sortOrder,
          active: e.active,
        }),
      ),
    };
  }

  /** The public read: nothing retired. */
  async publicFormConfig(): Promise<PsfFormConfig> {
    const config = await this.formConfig();
    return { ...config, extras: config.extras.filter((e) => e.active) };
  }

  async formSetup(grants: OversightGrant[]): Promise<PsfFormSetupView> {
    return { ...(await this.formConfig()), canEdit: this.isNational(grants) };
  }

  async updateFormField(userId: string, grants: OversightGrant[], key: string, input: UpdatePsfFormFieldSettingRequest): Promise<PsfFormSetupView> {
    this.national(grants);
    const field = PSF_FORM_FIELDS.find((f) => f.key === key);
    if (!field) throw new NotFoundException('That field is not on the form.');
    if (field.locked && (input.required !== undefined || input.visible !== undefined)) {
      throw refused(['required'], `“${field.label}” stays on the form and required: the system needs it. You can change its wording and order.`);
    }
    await this.repo.saveFormSetting(
      key,
      {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.help !== undefined ? { helpText: input.help ?? '' } : {}),
        ...(input.required !== undefined ? { required: input.required } : {}),
        ...(input.visible !== undefined ? { visible: input.visible } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
      userId,
    );
    return this.formSetup(grants);
  }

  async createExtra(grants: OversightGrant[], input: CreatePsfFormExtraRequest): Promise<PsfFormSetupView> {
    this.national(grants);
    const extras = await this.repo.extras();
    const base = psfCodeFrom(input.label).slice(0, 34);
    const taken = new Set(extras.map((e) => e.key));
    let key = base.length >= 2 ? base : `q_${base}`;
    for (let i = 2; taken.has(key); i++) key = `${base}_${i}`;
    await this.repo.insertExtra({
      key,
      step: input.step,
      label: input.label,
      helpText: input.help ?? null,
      fieldType: input.fieldType,
      required: input.required,
      options: input.fieldType === 'select' ? input.options : [],
      sortOrder: Math.max(0, ...extras.map((e) => e.sortOrder)) + 10,
    });
    return this.formSetup(grants);
  }

  async updateExtra(grants: OversightGrant[], id: string, input: UpdatePsfFormExtraRequest): Promise<PsfFormSetupView> {
    this.national(grants);
    const done = await this.repo.updateExtra(id, {
      ...(input.step !== undefined ? { step: input.step } : {}),
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.help !== undefined ? { helpText: input.help } : {}),
      ...(input.required !== undefined ? { required: input.required } : {}),
      ...(input.options !== undefined ? { options: input.options } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    });
    if (!done) throw new NotFoundException('That question is not on the form.');
    return this.formSetup(grants);
  }

  /**
   * What the form's settings ask of a submission, on the server as well as in the browser, and the extra
   * answers to keep. Only answers to live questions are kept: anything else in the bag is dropped.
   */
  async assertSubmission(
    values: Partial<Record<(typeof PSF_FORM_FIELDS)[number]['key'], unknown>>,
    answers: PsfExtraAnswers,
  ): Promise<Record<string, string | number | boolean>> {
    const config = await this.publicFormConfig();
    const PATHS: Partial<Record<(typeof PSF_FORM_FIELDS)[number]['key'], string[]>> = {
      website: ['business', 'website'],
      businessActivity: ['business', 'businessActivity'],
      ownerGroups: ['business', 'ownerGroups'],
      cell: ['business', 'address', 'cellId'],
      village: ['business', 'address', 'villageId'],
      street: ['business', 'address', 'street'],
      photo: ['contact', 'photoObjectKey'],
      email: ['contact', 'email'],
      logo: ['business', 'logoObjectKey'],
    };
    for (const field of config.fields) {
      if (field.locked || !field.required || !field.visible) continue;
      const value = values[field.key as keyof typeof values];
      const blank = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
      if (blank) throw refused(PATHS[field.key as keyof typeof PATHS] ?? [field.key], `Fill in “${field.label}”.`);
    }
    const kept: Record<string, string | number | boolean> = {};
    for (const extra of config.extras) {
      const value = answers[extra.key];
      const problem = psfExtraAnswerProblem(extra, value);
      if (problem) throw refused(['extras', extra.key], problem);
      if (value !== undefined && value !== '') kept[extra.key] = value;
    }
    return kept;
  }

  /** One field's own check, for a form that sends just that field again. */
  async assertFieldFilled(key: string, value: unknown, path: (string | number)[]): Promise<void> {
    const field = (await this.publicFormConfig()).fields.find((f) => f.key === key);
    if (field?.required && field.visible && (value === undefined || value === null || value === '')) throw refused(path, `Fill in “${field.label}”.`);
  }

  // --- The catalogue ---------------------------------------------------------------

  async createCluster(userId: string, grants: OversightGrant[], input: AddPsfSectorRequest): Promise<void> {
    this.national(grants);
    const clusters = await this.psfRepo.clusters(false);
    const inserted = await this.repo.insertCluster({
      code: psfCodeFrom(input.name),
      nameEn: input.name,
      description: input.description ?? null,
      sortOrder: Math.max(0, ...clusters.map((c) => c.sortOrder)) + 1,
      userId,
    });
    if (!inserted) throw new ConflictException('There is already a sector with that name.');
  }

  async updateCluster(userId: string, grants: OversightGrant[], code: string, input: ChangePsfSectorRequest): Promise<void> {
    this.national(grants);
    const done = await this.repo.updateCluster(
      code,
      {
        ...(input.name !== undefined ? { nameEn: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
      userId,
    );
    if (!done) throw new NotFoundException('That sector is not on PSF’s list.');
  }

  async createAssociation(userId: string, grants: OversightGrant[], input: AddPsfAssociationRequest): Promise<void> {
    this.national(grants);
    const [clusters, associations] = await Promise.all([this.psfRepo.clusters(true), this.psfRepo.associations(false)]);
    if (!clusters.some((c) => c.code === input.clusterCode)) throw refused(['clusterCode'], 'Pick a sector PSF still has.');
    const inserted = await this.repo.insertAssociation({
      code: psfCodeFrom(input.name),
      clusterCode: input.clusterCode,
      nameEn: input.name,
      acronym: input.acronym ?? null,
      sortOrder: Math.max(0, ...associations.filter((a) => a.clusterCode === input.clusterCode && a.sortOrder < 999).map((a) => a.sortOrder)) + 1,
      userId,
    });
    if (!inserted) throw new ConflictException('There is already an association with that name.');
  }

  async updateAssociation(userId: string, grants: OversightGrant[], code: string, input: ChangePsfAssociationRequest): Promise<void> {
    this.national(grants);
    const done = await this.repo.updateAssociation(
      code,
      {
        ...(input.name !== undefined ? { nameEn: input.name } : {}),
        ...(input.acronym !== undefined ? { acronym: input.acronym } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
      userId,
    );
    if (!done) throw new NotFoundException('That association is not on PSF’s list.');
  }
}

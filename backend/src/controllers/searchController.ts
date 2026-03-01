/**
 * GET /api/search?q=<query>&limit=<n>&users_offset=<n>&designs_offset=<n>
 *
 * Public endpoint — no auth required.
 * Searches discoverable users (by displayName + affiliation) and
 * published/locked designs (by title, summary, hypothesis).
 *
 * All filtering is done in-memory after fetching from Firestore, which
 * is fine at this platform's scale. The caller controls pagination via
 * users_offset and designs_offset so the two result sets can be
 * loaded-more independently on the Search Results page.
 */
import type { Request, Response, NextFunction } from 'express'
import { adminDb } from '../lib/firebase'
import type { Design } from '../types/design'

const USERS   = 'users'
const DESIGNS = 'designs'

interface StoredUserProfile {
  uid: string
  displayName: string
  affiliation?: string | null
  role?: string | null
  discoverable: boolean
}

export interface SearchUser {
  uid: string
  displayName: string
  affiliation: string | null
  role: string | null
}

export interface SearchDesign {
  id: string
  title: string
  summary: string
  hypothesis?: string
  status: string
  difficulty_level: string
  discipline_tags: string[]
  author_ids: string[]
  execution_count: number
  derived_design_count: number
}

export async function search(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const q              = ((req.query.q as string) ?? '').trim().toLowerCase()
    const limit          = Math.min(parseInt((req.query.limit          as string) ?? '20'), 50)
    const usersOffset    = Math.max(0, parseInt((req.query.users_offset   as string) ?? '0'))
    const designsOffset  = Math.max(0, parseInt((req.query.designs_offset as string) ?? '0'))

    if (!q) {
      res.json({ status: 'ok', data: { users: [], designs: [], total_users: 0, total_designs: 0 } })
      return
    }

    const [usersSnap, designsSnap] = await Promise.all([
      adminDb.collection(USERS).where('discoverable', '==', true).get(),
      adminDb.collection(DESIGNS).where('status', 'in', ['published', 'locked']).get(),
    ])

    const userProfiles: StoredUserProfile[] = usersSnap.docs.map(
      (d) => d.data() as StoredUserProfile,
    )
    const allUsers: SearchUser[] = userProfiles
      .filter(
        (p: StoredUserProfile) =>
          p.displayName?.toLowerCase().includes(q) ||
          p.affiliation?.toLowerCase().includes(q),
      )
      .map((p: StoredUserProfile) => ({
        uid:         p.uid,
        displayName: p.displayName,
        affiliation: p.affiliation ?? null,
        role:        p.role ?? null,
      }))

    const allDesignDocs: SearchDesign[] = designsSnap.docs.map((d) => {
      const design = d.data() as Design
      return {
        id:                   d.id,
        title:                design.title,
        summary:              design.summary,
        hypothesis:           design.hypothesis,
        status:               design.status,
        difficulty_level:     design.difficulty_level,
        discipline_tags:      design.discipline_tags,
        author_ids:           design.author_ids,
        execution_count:      design.execution_count,
        derived_design_count: design.derived_design_count,
      }
    })
    const allDesigns: SearchDesign[] = allDesignDocs.filter(
      (d: SearchDesign) =>
        d.title.toLowerCase().includes(q) ||
        d.summary?.toLowerCase().includes(q) ||
        d.hypothesis?.toLowerCase().includes(q),
    )

    res.json({
      status: 'ok',
      data: {
        users:         allUsers.slice(usersOffset, usersOffset + limit),
        designs:       allDesigns.slice(designsOffset, designsOffset + limit),
        total_users:   allUsers.length,
        total_designs: allDesigns.length,
      },
    })
  } catch (err) {
    next(err)
  }
}
